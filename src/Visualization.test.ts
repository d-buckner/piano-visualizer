import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import Visualization from './Visualization';

// Mock PIXI.js components
vi.mock('pixi.js', () => ({
  Application: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    stage: { addChild: vi.fn() },
    canvas: document.createElement('canvas'),
    ticker: { add: vi.fn() },
    destroy: vi.fn()
  })),
  Container: vi.fn().mockImplementation(() => ({
    addChild: vi.fn(),
    removeChild: vi.fn(),
    x: 0,
    y: 0,
    children: []
  }))
}));

// Mock Piano and PianoRoll
vi.mock('./Piano', () => ({
  default: vi.fn().mockImplementation(() => ({
    keyDown: vi.fn(),
    keyUp: vi.fn(),
    render: vi.fn()
  }))
}));

vi.mock('./PianoRoll', () => ({
  default: vi.fn().mockImplementation(() => ({
    startNote: vi.fn(),
    endNote: vi.fn(),
    render: vi.fn()
  }))
}));

describe('Visualization', () => {
  let visualization: Visualization;
  let mockContainer: HTMLElement;
  let mockResizeObserver: MockedFunction<any>;
  let resizeCallback: (entries: ResizeObserverEntry[]) => void;

  beforeEach(() => {
    // Create mock container
    mockContainer = document.createElement('div');
    Object.defineProperty(mockContainer, 'clientWidth', { value: 1200 });
    Object.defineProperty(mockContainer, 'clientHeight', { value: 800 });

    // Mock ResizeObserver
    mockResizeObserver = vi.fn().mockImplementation((callback) => {
      resizeCallback = callback;
      return {
        observe: vi.fn(),
        disconnect: vi.fn()
      };
    });
    global.ResizeObserver = mockResizeObserver;

    // Mock appendChild to prevent DOM manipulation in tests
    vi.spyOn(mockContainer, 'append').mockImplementation(() => {});
  });

  describe('resize behavior', () => {
    it('should immediately sync container position when layout changes during resize', async () => {
      visualization = new Visualization({
        container: mockContainer
      });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));

      // Get initial layout and container state
      const layout = visualization['layout'];
      const renderContainer = visualization['renderContainer'];
      
      // Set an initial position (user has scrolled)
      layout.setX(1000);
      renderContainer.x = 1000;
      visualization['containerTargetX'] = 1000;

      // Simulate resize that changes width factor
      const mockEntry = {
        contentRect: {
          width: 800,  // Smaller width
          height: 800
        }
      } as ResizeObserverEntry;

      // Trigger resize callback
      resizeCallback([mockEntry]);

      // Verify that renderContainer.x was immediately synced to layout.getX()
      expect(renderContainer.x).toBe(layout.getX());
      expect(visualization['containerTargetX']).toBe(layout.getX());
    });

    it('should handle breakpoint transitions during resize', async () => {
      visualization = new Visualization({
        container: mockContainer
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      const layout = visualization['layout'];
      const renderContainer = visualization['renderContainer'];
      
      // Set initial position
      layout.setX(500);
      renderContainer.x = 500;

      // Get initial diatonic range
      const initialRange = layout.getDiatonicRange();

      // Simulate resize that crosses breakpoint (1200px -> 600px should change range)
      const mockEntry = {
        contentRect: {
          width: 600,  // This should trigger breakpoint change
          height: 800
        }
      } as ResizeObserverEntry;

      resizeCallback([mockEntry]);

      // Verify container is synced even across breakpoint changes
      expect(renderContainer.x).toBe(layout.getX());
      expect(visualization['containerTargetX']).toBe(layout.getX());
      
      // Verify that diatonic range actually changed (confirming breakpoint crossed)
      expect(layout.getDiatonicRange()).not.toBe(initialRange);
    });

    it('should maintain sync when no layout position change occurs', async () => {
      visualization = new Visualization({
        container: mockContainer
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      const layout = visualization['layout'];
      const renderContainer = visualization['renderContainer'];
      
      // Set initial position at origin
      layout.setX(0);
      renderContainer.x = 0;

      // Simulate resize without position change
      const mockEntry = {
        contentRect: {
          width: 1000,  // Different width but shouldn't change position much at origin
          height: 800
        }
      } as ResizeObserverEntry;

      resizeCallback([mockEntry]);

      // Container should still be synced
      expect(renderContainer.x).toBe(layout.getX());
      expect(visualization['containerTargetX']).toBe(layout.getX());
    });
  });

  describe('cleanup', () => {
    it('should disconnect ResizeObserver on destroy', async () => {
      visualization = new Visualization({
        container: mockContainer
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      const disconnectSpy = vi.spyOn(visualization['resizeObserver'], 'disconnect');
      
      visualization.destroy();
      
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});