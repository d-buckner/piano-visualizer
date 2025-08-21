import { describe, it, expect, beforeEach, vi } from 'vitest';
import PianoController from './PianoController';
import { Graphics } from 'pixi.js';
import Cursor, { CursorType } from '../lib/Cursor';
import type Layout from '../Layout';

vi.mock('../lib/Cursor', () => ({
  default: {
    set: vi.fn(),
  },
  CursorType: {
    POINTER: 'pointer',
  },
}));

describe('PianoController', () => {
  let controller: PianoController;
  let graphics: Graphics[];
  let onKeyDown: ReturnType<typeof vi.fn>;
  let onKeyUp: ReturnType<typeof vi.fn>;
  let mockLayout: Layout;
  const pianoY = 500;
  const containerHeight = 800;
  const containerWidth = 1200;

  beforeEach(() => {
    onKeyDown = vi.fn();
    onKeyUp = vi.fn();
    
    // Create mock layout
    mockLayout = {
      getPianoY: vi.fn().mockReturnValue(pianoY),
      getHeight: vi.fn().mockReturnValue(containerHeight),
      getWidth: vi.fn().mockReturnValue(containerWidth),
    } as unknown as Layout;
    
    // Create mock graphics objects for 88 keys
    graphics = Array.from({ length: 88 }, (_, i) => {
      const graphic = new Graphics();
      graphic.on = vi.fn();
      graphic.eventMode = 'static';
      return graphic;
    });

    controller = new PianoController({
      graphics,
      onKeyDown,
      onKeyUp,
      layout: mockLayout,
    });
  });

  describe('mouse events', () => {
    it('should trigger onKeyDown when mouse is pressed on a key', () => {
      const keyIndex = 39; // Middle C (MIDI 60)
      const mousedownHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'mousedown'
      )[1];

      mousedownHandler();

      expect(onKeyDown).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should trigger onKeyUp when mouse is released', () => {
      const keyIndex = 39;
      const handlers = (graphics[keyIndex].on as any).mock.calls;
      const mousedownHandler = handlers.find((call: any) => call[0] === 'mousedown')[1];
      const mouseupHandler = handlers.find((call: any) => call[0] === 'mouseup')[1];

      mousedownHandler();
      mouseupHandler();

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should handle mouse drag between keys', () => {
      const key1 = 39;
      const key2 = 40;
      
      // Get handlers
      const mousedown1 = (graphics[key1].on as any).mock.calls.find(
        (call: any) => call[0] === 'mousedown'
      )[1];
      const mouseenter2 = (graphics[key2].on as any).mock.calls.find(
        (call: any) => call[0] === 'mouseenter'
      )[1];

      // Mouse down on first key
      mousedown1();
      expect(onKeyDown).toHaveBeenCalledWith(key1 + 21);

      // Mouse enters second key while pressed
      mouseenter2();
      expect(onKeyUp).toHaveBeenCalledWith(key1 + 21);
      expect(onKeyDown).toHaveBeenCalledWith(key2 + 21);
    });

    it('should release key when mouse moves above piano', () => {
      const keyIndex = 39;
      const globalHandlers = (graphics[0].on as any).mock.calls;
      const mousedownHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'mousedown'
      )[1];
      const globalMouseMoveHandler = globalHandlers.find(
        (call: any) => call[0] === 'globalmousemove'
      )[1];

      // Mouse down on key
      mousedownHandler();

      // Move mouse above piano
      globalMouseMoveHandler({ clientY: pianoY - 10 });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should set cursor to pointer when hovering over piano', () => {
      const globalMouseMoveHandler = (graphics[0].on as any).mock.calls.find(
        (call: any) => call[0] === 'globalmousemove'
      )[1];

      globalMouseMoveHandler({ clientY: pianoY + 10 });

      expect(Cursor.set).toHaveBeenCalledWith(CursorType.POINTER);
    });
  });

  describe('touch events', () => {
    it('should trigger onKeyDown when touch starts on a key', () => {
      const keyIndex = 39;
      const touchStartHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchstart'
      )[1];

      const event = { preventDefault: vi.fn(), pointerId: 1 };
      touchStartHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(onKeyDown).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should handle touch move between keys', () => {
      const key1 = 39;
      const key2 = 40;
      const pointerId = 1;

      // Touch start on first key
      const touchStart1 = (graphics[key1].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchstart'
      )[1];
      touchStart1({ preventDefault: vi.fn(), pointerId });

      // Touch moves to second key
      const touchMove2 = (graphics[key2].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchmove'
      )[1];
      const event = { preventDefault: vi.fn(), pointerId };
      touchMove2(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(onKeyUp).toHaveBeenCalledWith(key1 + 21);
      expect(onKeyDown).toHaveBeenCalledWith(key2 + 21);
    });

    it('should release key on touchend', () => {
      const keyIndex = 39;
      const pointerId = 1;
      const handlers = (graphics[keyIndex].on as any).mock.calls;
      
      const touchStartHandler = handlers.find((call: any) => call[0] === 'touchstart')[1];
      const touchEndHandler = handlers.find((call: any) => call[0] === 'touchend')[1];

      touchStartHandler({ preventDefault: vi.fn(), pointerId });
      touchEndHandler({ preventDefault: vi.fn(), pointerId });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should release key on touchcancel', () => {
      const keyIndex = 39;
      const pointerId = 1;
      const handlers = (graphics[keyIndex].on as any).mock.calls;
      
      const touchStartHandler = handlers.find((call: any) => call[0] === 'touchstart')[1];
      const touchCancelHandler = handlers.find((call: any) => call[0] === 'touchcancel')[1];

      touchStartHandler({ preventDefault: vi.fn(), pointerId });
      touchCancelHandler({ preventDefault: vi.fn(), pointerId });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should release key when touch moves above piano', () => {
      const keyIndex = 39;
      const pointerId = 1;
      
      // Start touch on key
      const touchStartHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchstart'
      )[1];
      touchStartHandler({ preventDefault: vi.fn(), pointerId });

      // Move touch above piano
      const globalTouchMoveHandler = (graphics[0].on as any).mock.calls.find(
        (call: any) => call[0] === 'globaltouchmove'
      )[1];
      globalTouchMoveHandler({ pointerId, clientY: pianoY - 10 });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should release key when touch moves below container bounds', () => {
      const keyIndex = 39;
      const pointerId = 1;
      
      // Start touch on key
      const touchStartHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchstart'
      )[1];
      touchStartHandler({ preventDefault: vi.fn(), pointerId });

      // Move touch below container
      const globalTouchMoveHandler = (graphics[0].on as any).mock.calls.find(
        (call: any) => call[0] === 'globaltouchmove'
      )[1];
      globalTouchMoveHandler({ pointerId, clientY: containerHeight + 10 });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should handle global touchend to prevent stuck keys', () => {
      const keyIndex = 39;
      const pointerId = 1;
      
      // Start touch on key
      const touchStartHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchstart'
      )[1];
      touchStartHandler({ preventDefault: vi.fn(), pointerId });

      // Global touch end (outside any key)
      const globalTouchEndHandler = (graphics[0].on as any).mock.calls.find(
        (call: any) => call[0] === 'globaltouchend'
      )[1];
      globalTouchEndHandler({ pointerId });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should handle global touchcancel to prevent stuck keys', () => {
      const keyIndex = 39;
      const pointerId = 1;
      
      // Start touch on key
      const touchStartHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchstart'
      )[1];
      touchStartHandler({ preventDefault: vi.fn(), pointerId });

      // Global touch cancel
      const globalTouchCancelHandler = (graphics[0].on as any).mock.calls.find(
        (call: any) => call[0] === 'globaltouchcancel'
      )[1];
      globalTouchCancelHandler({ pointerId });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should handle multiple simultaneous touches', () => {
      const key1 = 39;
      const key2 = 41;
      const pointerId1 = 1;
      const pointerId2 = 2;

      // First touch
      const touchStart1 = (graphics[key1].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchstart'
      )[1];
      touchStart1({ preventDefault: vi.fn(), pointerId: pointerId1 });

      // Second touch
      const touchStart2 = (graphics[key2].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchstart'
      )[1];
      touchStart2({ preventDefault: vi.fn(), pointerId: pointerId2 });

      expect(onKeyDown).toHaveBeenCalledWith(key1 + 21);
      expect(onKeyDown).toHaveBeenCalledWith(key2 + 21);

      // Release first touch
      const touchEnd1 = (graphics[key1].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchend'
      )[1];
      touchEnd1({ preventDefault: vi.fn(), pointerId: pointerId1 });

      expect(onKeyUp).toHaveBeenCalledWith(key1 + 21);
      expect(onKeyUp).not.toHaveBeenCalledWith(key2 + 21);
    });
  });

  describe('boundary detection', () => {
    it('should release key when mouse moves left of piano', () => {
      const keyIndex = 39;
      const mousedownHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'mousedown'
      )[1];
      const globalMouseMoveHandler = (graphics[0].on as any).mock.calls.find(
        (call: any) => call[0] === 'globalmousemove'
      )[1];

      mousedownHandler();
      globalMouseMoveHandler({ clientX: -10, clientY: pianoY + 50 });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should release key when mouse moves right of piano', () => {
      const keyIndex = 39;
      const mousedownHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'mousedown'
      )[1];
      const globalMouseMoveHandler = (graphics[0].on as any).mock.calls.find(
        (call: any) => call[0] === 'globalmousemove'
      )[1];

      mousedownHandler();
      globalMouseMoveHandler({ clientX: containerWidth + 10, clientY: pianoY + 50 });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should release key when mouse moves below piano', () => {
      const keyIndex = 39;
      const mousedownHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'mousedown'
      )[1];
      const globalMouseMoveHandler = (graphics[0].on as any).mock.calls.find(
        (call: any) => call[0] === 'globalmousemove'
      )[1];

      mousedownHandler();
      globalMouseMoveHandler({ clientX: 600, clientY: containerHeight + 10 });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should release key when touch moves left of piano', () => {
      const keyIndex = 39;
      const pointerId = 1;
      const touchStartHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchstart'
      )[1];
      const globalTouchMoveHandler = (graphics[0].on as any).mock.calls.find(
        (call: any) => call[0] === 'globaltouchmove'
      )[1];

      touchStartHandler({ preventDefault: vi.fn(), pointerId });
      globalTouchMoveHandler({ pointerId, clientX: -10, clientY: pianoY + 50 });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });

    it('should release key when touch moves right of piano', () => {
      const keyIndex = 39;
      const pointerId = 1;
      const touchStartHandler = (graphics[keyIndex].on as any).mock.calls.find(
        (call: any) => call[0] === 'touchstart'
      )[1];
      const globalTouchMoveHandler = (graphics[0].on as any).mock.calls.find(
        (call: any) => call[0] === 'globaltouchmove'
      )[1];

      touchStartHandler({ preventDefault: vi.fn(), pointerId });
      globalTouchMoveHandler({ pointerId, clientX: containerWidth + 10, clientY: pianoY + 50 });

      expect(onKeyUp).toHaveBeenCalledWith(keyIndex + 21);
    });
  });

});