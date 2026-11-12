import { describe, it, expect, vi, beforeEach } from 'vitest';
import KeyboardInput from './keyboardInput.js';
import Layout from '../Layout.js';

function makeLayout() {
  return new Layout({ width: 900, height: 600, pianoHeight: 200 });
}

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = () => ({
    left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600, x: 0, y: 0,
  } as DOMRect);
  document.body.append(canvas);
  return canvas;
}

function centreOf(layout: Layout, midi: number) {
  const element = layout.getKeyElement(midi);
  return {
    clientX: element.x + layout.getX() + element.width / 2,
    clientY: layout.getPianoY() + element.height / 2,
  };
}

/** happy-dom has no PointerEvent, so build an event carrying the fields used */
function fire(canvas: HTMLCanvasElement, type: string, init: { clientX: number; clientY: number; pointerId: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, init);
  canvas.dispatchEvent(event);
  return event;
}

describe('KeyboardInput', () => {
  let canvas: HTMLCanvasElement;
  let layout: Layout;
  let down: ReturnType<typeof vi.fn>;
  let up: ReturnType<typeof vi.fn>;
  let input: KeyboardInput;

  beforeEach(() => {
    document.body.innerHTML = '';
    canvas = makeCanvas();
    layout = makeLayout();
    down = vi.fn();
    up = vi.fn();
    input = new KeyboardInput({ canvas, layout, onKeyDown: down, onKeyUp: up });
  });

  it('presses the key under a pointer', () => {
    fire(canvas, 'pointerdown', { ...centreOf(layout, 60), pointerId: 1 });

    expect(down).toHaveBeenCalledWith(60);
    expect(input.heldCount).toBe(1);
  });

  it('keeps two fingers down as two notes', () => {
    fire(canvas, 'pointerdown', { ...centreOf(layout, 60), pointerId: 1 });
    fire(canvas, 'pointerdown', { ...centreOf(layout, 64), pointerId: 2 });

    expect(down).toHaveBeenNthCalledWith(1, 60);
    expect(down).toHaveBeenNthCalledWith(2, 64);
    expect(up).not.toHaveBeenCalled();
    expect(input.heldCount).toBe(2);
  });

  it('releases only the note belonging to the lifted finger', () => {
    fire(canvas, 'pointerdown', { ...centreOf(layout, 60), pointerId: 1 });
    fire(canvas, 'pointerdown', { ...centreOf(layout, 64), pointerId: 2 });
    fire(canvas, 'pointerup', { ...centreOf(layout, 64), pointerId: 2 });

    expect(up).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledWith(64);
    expect(input.heldCount).toBe(1);
  });

  it('glides to a new key while a pointer is held', () => {
    fire(canvas, 'pointerdown', { ...centreOf(layout, 60), pointerId: 1 });
    fire(canvas, 'pointermove', { ...centreOf(layout, 62), pointerId: 1 });

    expect(down).toHaveBeenNthCalledWith(1, 60);
    expect(down).toHaveBeenNthCalledWith(2, 62);
    expect(up).toHaveBeenCalledWith(60);
    expect(input.heldCount).toBe(1);
  });

  it('ignores a move from a pointer that never pressed', () => {
    fire(canvas, 'pointerdown', { ...centreOf(layout, 60), pointerId: 1 });
    fire(canvas, 'pointermove', { ...centreOf(layout, 72), pointerId: 99 });

    expect(down).toHaveBeenCalledTimes(1);
    expect(up).not.toHaveBeenCalled();
  });

  it('releases when a held pointer leaves the keyboard', () => {
    fire(canvas, 'pointerdown', { ...centreOf(layout, 60), pointerId: 1 });
    fire(canvas, 'pointermove', { clientX: 400, clientY: 50, pointerId: 1 });

    expect(up).toHaveBeenCalledWith(60);
    expect(input.heldCount).toBe(0);
  });

  it('ignores presses above the keyboard', () => {
    fire(canvas, 'pointerdown', { clientX: 400, clientY: 50, pointerId: 1 });

    expect(down).not.toHaveBeenCalled();
  });

  it('releases everything on dispose', () => {
    fire(canvas, 'pointerdown', { ...centreOf(layout, 60), pointerId: 1 });
    fire(canvas, 'pointerdown', { ...centreOf(layout, 64), pointerId: 2 });
    input.dispose();

    expect(up).toHaveBeenCalledTimes(2);
    expect(input.heldCount).toBe(0);

    down.mockClear();
    fire(canvas, 'pointerdown', { ...centreOf(layout, 67), pointerId: 3 });
    expect(down).not.toHaveBeenCalled();
  });
});
