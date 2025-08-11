import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import VisualizationController from './VisualizationController';
import Layout, { Section } from '../Layout';
import Cursor, { CursorType } from '../lib/Cursor';

vi.mock('../lib/Cursor', () => ({
  default: {
    set: vi.fn(),
    reset: vi.fn(),
  },
  CursorType: {
    GRAB: 'grab',
    GRABBING: 'grabbing',
  },
}));

vi.mock('../lib/debounce', () => ({
  default: (fn: Function) => fn,
}));

describe('VisualizationController', () => {
  let controller: VisualizationController;
  let canvas: HTMLCanvasElement;
  let layout: Layout;
  let onContainerTargetXChange: ReturnType<typeof vi.fn>;
  let onContainerXChange: ReturnType<typeof vi.fn>;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let abortSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    onContainerTargetXChange = vi.fn();
    onContainerXChange = vi.fn();
    
    layout = {
      getSection: vi.fn().mockReturnValue(Section.PIANO_ROLL),
      getX: vi.fn().mockReturnValue(0),
      getClampedX: vi.fn((x) => x),
      getQuantizedX: vi.fn((x) => Math.round(x)),
      getPianoHeight: vi.fn().mockReturnValue(200),
      getWidthFactor: vi.fn().mockReturnValue(1),
      setWidthFactor: vi.fn(),
      getClampedWidthFactor: vi.fn((f) => f),
      getQuantizedWidthFactor: vi.fn((f) => Math.round(f * 4) / 4),
    } as any;

    abortSpy = vi.fn();
    global.AbortController = vi.fn().mockImplementation(() => ({
      signal: { 
        aborted: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      abort: abortSpy,
    }));

    addEventListenerSpy = vi.spyOn(canvas, 'addEventListener');

    controller = new VisualizationController({
      canvas,
      layout,
      onContainerTargetXChange,
      onContainerXChange,
      onWidthFactorChange: vi.fn(),
      onWidthFactorTargetChange: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should register all event listeners', () => {
      const expectedEvents = [
        'mousedown', 'mouseup', 'mousemove', 'mouseleave',
        'touchstart', 'touchend', 'touchmove', 'wheel'
      ];

      expectedEvents.forEach(eventType => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          eventType,
          expect.any(Function),
          expect.objectContaining({
            signal: expect.any(Object),
          })
        );
      });
    });

    it('should set passive option for wheel events', () => {
      const wheelCall = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'wheel'
      );
      
      expect(wheelCall?.[2]).toMatchObject({
        passive: false,
      });
    });
  });

  describe('mouse events', () => {
    it('should handle mouse down in piano roll section', () => {
      const mousedownHandler = getEventHandler('mousedown');
      const event = new MouseEvent('mousedown', { clientX: 100, clientY: 300 });
      
      mousedownHandler(event);
      
      expect(layout.getSection).toHaveBeenCalledWith(300);
    });

    it('should ignore mouse down in piano section', () => {
      (layout.getSection as any).mockReturnValue(Section.PIANO);
      const mousedownHandler = getEventHandler('mousedown');
      const event = new MouseEvent('mousedown', { clientX: 100, clientY: 600 });
      
      mousedownHandler(event);
      
      expect(onContainerXChange).not.toHaveBeenCalled();
    });

    it('should update container position on mouse drag', () => {
      const mousedownHandler = getEventHandler('mousedown');
      const mousemoveHandler = getEventHandler('mousemove');
      
      // Mouse down
      mousedownHandler(new MouseEvent('mousedown', { clientX: 100, clientY: 300 }));
      
      // Mouse move
      mousemoveHandler(new MouseEvent('mousemove', { clientX: 150, clientY: 300 }));
      
      expect(Cursor.set).toHaveBeenCalledWith(CursorType.GRABBING);
      expect(onContainerXChange).toHaveBeenCalledWith(50); // Delta of 50
      expect(onContainerTargetXChange).toHaveBeenCalledWith(50);
    });

    it('should reset on mouse up', () => {
      const mousedownHandler = getEventHandler('mousedown');
      const mouseupHandler = getEventHandler('mouseup');
      
      mousedownHandler(new MouseEvent('mousedown', { clientX: 100, clientY: 300 }));
      mouseupHandler(new MouseEvent('mouseup'));
      
      expect(onContainerTargetXChange).toHaveBeenCalled();
    });

    it('should set grab cursor on hover over piano roll', () => {
      const mousemoveHandler = getEventHandler('mousemove');
      
      mousemoveHandler(new MouseEvent('mousemove', { clientX: 100, clientY: 300 }));
      
      expect(Cursor.set).toHaveBeenCalledWith(CursorType.GRAB);
    });

    it('should reset on mouse leave', () => {
      const mouseleaveHandler = getEventHandler('mouseleave');
      
      mouseleaveHandler(new MouseEvent('mouseleave'));
      
      expect(onContainerTargetXChange).toHaveBeenCalled();
    });
  });

  describe('touch events', () => {
    it('should handle touch start in piano roll', () => {
      const touchstartHandler = getEventHandler('touchstart');
      const event = createTouchEvent('touchstart', [
        { identifier: 1, clientX: 100, clientY: 300 }
      ]);
      
      touchstartHandler(event);
      
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should ignore touch start in piano section', () => {
      (layout.getSection as any).mockReturnValue(Section.PIANO);
      const touchstartHandler = getEventHandler('touchstart');
      const event = createTouchEvent('touchstart', [
        { identifier: 1, clientX: 100, clientY: 600 }
      ]);
      
      touchstartHandler(event);
      
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should update container position on touch move', () => {
      const touchstartHandler = getEventHandler('touchstart');
      const touchmoveHandler = getEventHandler('touchmove');
      
      // Touch start
      touchstartHandler(createTouchEvent('touchstart', [
        { identifier: 1, clientX: 100, clientY: 300 }
      ]));
      
      // Touch move
      const moveEvent = createTouchEvent('touchmove', [], [
        { identifier: 1, clientX: 150, clientY: 300 }
      ]);
      touchmoveHandler(moveEvent);
      
      expect(moveEvent.preventDefault).toHaveBeenCalled();
      expect(onContainerXChange).toHaveBeenCalledWith(50);
      expect(onContainerTargetXChange).toHaveBeenCalledWith(50);
    });

    it('should handle touch end', () => {
      const touchstartHandler = getEventHandler('touchstart');
      const touchendHandler = getEventHandler('touchend');
      
      touchstartHandler(createTouchEvent('touchstart', [
        { identifier: 1, clientX: 100, clientY: 300 }
      ]));
      
      const endEvent = createTouchEvent('touchend', []);
      touchendHandler(endEvent);
      
      expect(endEvent.preventDefault).toHaveBeenCalled();
      expect(onContainerTargetXChange).toHaveBeenCalled();
    });

    it('should handle multiple simultaneous touches', () => {
      const touchstartHandler = getEventHandler('touchstart');
      
      const event = createTouchEvent('touchstart', [
        { identifier: 1, clientX: 100, clientY: 300 },
        { identifier: 2, clientX: 200, clientY: 350 }
      ]);
      
      touchstartHandler(event);
      
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('wheel events', () => {
    it('should update container position on wheel', () => {
      const wheelHandler = getEventHandler('wheel');
      const event = new WheelEvent('wheel', { deltaX: 50 });
      
      (layout.getX as any).mockReturnValue(100);
      (layout.getClampedX as any).mockReturnValue(50);
      (layout.getQuantizedX as any).mockReturnValue(50);
      
      wheelHandler(event);
      
      expect(onContainerXChange).toHaveBeenCalledWith(50);
      expect(onContainerTargetXChange).toHaveBeenCalledWith(50);
    });
  });

  describe('gesture completion', () => {
    it('should quantize position when mouse gesture completes', () => {
      const mousedownHandler = getEventHandler('mousedown');
      const mousemoveHandler = getEventHandler('mousemove');
      const mouseupHandler = getEventHandler('mouseup');
      
      // Setup layout mocks for the gesture sequence
      (layout.getX as any).mockReturnValue(0); // Initial position
      (layout.getClampedX as any).mockImplementation((x) => x); // Pass through
      
      // Start gesture at initial position
      mousedownHandler(new MouseEvent('mousedown', { clientX: 100, clientY: 300 }));
      
      // Move to create a delta of 57 pixels (100 -> 157)
      mousemoveHandler(new MouseEvent('mousemove', { clientX: 157, clientY: 300 }));
      
      // Mock that layout now reports the moved position and quantization
      (layout.getX as any).mockReturnValue(57); // Moved position
      (layout.getQuantizedX as any).mockReturnValue(50); // Quantized result
      
      // Complete gesture - should quantize to nearest boundary
      mouseupHandler(new MouseEvent('mouseup'));
      
      // Verify quantized position was used (57 should quantize to 50)
      expect(onContainerTargetXChange).toHaveBeenLastCalledWith(50);
    });

    it('should quantize position when wheel gesture settles', () => {
      const wheelHandler = getEventHandler('wheel');
      
      (layout.getX as any).mockReturnValue(157); // Unquantized position
      (layout.getClampedX as any).mockReturnValue(157);
      (layout.getQuantizedX as any).mockReturnValue(150); // Quantized result
      
      wheelHandler(new WheelEvent('wheel', { deltaX: 7 }));
      
      // Verify quantized position was used for target
      expect(onContainerTargetXChange).toHaveBeenLastCalledWith(150);
    });

    it('should quantize position when touch gesture completes', () => {
      const touchstartHandler = getEventHandler('touchstart');
      const touchendHandler = getEventHandler('touchend');
      
      // Start touch
      touchstartHandler(createTouchEvent('touchstart', [
        { identifier: 1, clientX: 100, clientY: 300 }
      ]));
      
      (layout.getX as any).mockReturnValue(157); // Unquantized position
      (layout.getQuantizedX as any).mockReturnValue(150); // Quantized result
      
      // End all touches
      const endEvent = createTouchEvent('touchend', []);
      touchendHandler(endEvent);
      
      // Verify quantized position was used for target
      expect(onContainerTargetXChange).toHaveBeenLastCalledWith(150);
    });
  });

  describe('dispose', () => {
    it('should abort all event listeners', () => {
      controller.dispose();
      
      expect(abortSpy).toHaveBeenCalled();
    });
  });

  // Helper functions
  function getEventHandler(eventType: string): Function {
    const call = addEventListenerSpy.mock.calls.find(
      call => call[0] === eventType
    );
    return call?.[1] as Function;
  }

  function createTouchEvent(
    type: string, 
    touches: Array<{identifier: number, clientX: number, clientY: number}>,
    changedTouches?: Array<{identifier: number, clientX: number, clientY: number}>
  ): TouchEvent {
    const event = {
      type,
      touches,
      changedTouches: changedTouches || touches,
      preventDefault: vi.fn(),
    } as any;
    
    return event;
  }
});