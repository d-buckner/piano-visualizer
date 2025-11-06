import { describe, it, expect, vi } from 'vitest';
import PianoVisualization from './index';

// Mock the entire Visualization module
vi.mock('./Visualization', () => ({
  default: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    keyDown: vi.fn(),
    keyUp: vi.fn(),
    clearKeys: vi.fn(),
    redraw: vi.fn(),
  })),
}));

describe('index (main export)', () => {
  it('should export the Visualization class as default', () => {
    expect(PianoVisualization).toBeDefined();
    expect(typeof PianoVisualization).toBe('function');
  });

  it('should be constructable', () => {
    const container = document.createElement('div');
    const visualization = new PianoVisualization({ container });
    
    expect(visualization).toBeDefined();
  });

  it('should pass config to the Visualization constructor', () => {
    const container = document.createElement('div');
    const config = {
      container,
      backgroundColor: '#ff0000',
      onKeyDown: vi.fn(),
      onKeyUp: vi.fn(),
    };

    new PianoVisualization(config);

    expect(PianoVisualization).toHaveBeenCalledWith(config);
  });

  it('should have expected public methods', () => {
    const container = document.createElement('div');
    const visualization = new PianoVisualization({ container }) as any;

    expect(visualization.init).toBeDefined();
    expect(visualization.destroy).toBeDefined();
    expect(visualization.keyDown).toBeDefined();
    expect(visualization.keyUp).toBeDefined();
    expect(visualization.clearKeys).toBeDefined();
    expect(visualization.redraw).toBeDefined();
  });
});