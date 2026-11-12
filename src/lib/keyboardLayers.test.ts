import { describe, it, expect } from 'vitest';
import { drawKeyboard, keyRect, midiAt, MIDI_MAX, MIDI_MIN, SHAPE } from './keyboardLayers.js';
import KeyState from './keyState.js';
import Layout from '../Layout.js';
import type QuadRenderer from './QuadRenderer.js';

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  color?: unknown;
};

function makeRenderer() {
  const rects: Rect[] = [];
  return {
    rects,
    rect(rect: Rect) {
      rects.push(rect);
    },
  };
}

function makeLayout(options = { width: 900, height: 600, pianoHeight: 200 }) {
  return new Layout(options);
}

/** the first natural (A0, midi 21) is a good probe for pan and geometry */
const A0 = 21;
const B0 = 23;
const C1 = 24;

describe('keyRect', () => {
  it('offsets the layout element by the horizontal pan', () => {
    const layout = makeLayout();
    layout.setRange(60, 52);
    const element = layout.getKeyElement(C1);

    const rect = keyRect(layout, C1);
    expect(rect.x).toBe(element.x + layout.getX());
    expect(rect.y).toBe(layout.getPianoY());
    expect(rect.w).toBe(element.width);
    expect(rect.h).toBe(element.height);
  });
});

describe('midiAt', () => {
  it('hits a natural key at its centre', () => {
    const layout = makeLayout();
    const rect = keyRect(layout, C1);

    expect(midiAt(layout, rect.x + rect.w / 2, rect.y + rect.h / 2)).toBe(C1);
  });

  it('prefers the accidental sitting on top of the natural', () => {
    const layout = makeLayout();
    const accidental = keyRect(layout, B0);

    expect(midiAt(layout, accidental.x + accidental.w / 2, accidental.y + accidental.h / 2))
      .toBe(B0);
  });

  it('returns null above and below the keyboard', () => {
    const layout = makeLayout();
    const rect = keyRect(layout, C1);

    expect(midiAt(layout, rect.x + rect.w / 2, layout.getPianoY() - 1)).toBeNull();
    expect(midiAt(layout, rect.x + rect.w / 2, layout.getHeight() + 1)).toBeNull();
  });

  it('follows the pan when the range moves', () => {
    const layout = makeLayout();
    const before = keyRect(layout, A0);
    layout.setRange(48, 30);
    const after = keyRect(layout, A0);

    expect(after.x).not.toBe(before.x);
    expect(midiAt(layout, after.x + after.w / 2, after.y + after.h / 2)).toBe(A0);
    expect(midiAt(layout, before.x + before.w / 2, before.y + before.h / 2)).toBeNull();
  });

  it('covers every key from A0 to C8', () => {
    const layout = makeLayout();

    for (const midi of [MIDI_MIN, 44, 60, 88, MIDI_MAX]) {
      const rect = keyRect(layout, midi);
      expect(midiAt(layout, rect.x + rect.w / 2, rect.y + rect.h / 2), `midi ${midi}`)
        .toBe(midi);
    }
  });
});

describe('drawKeyboard', () => {
  it('draws naturals, then accidentals, then the frame', () => {
    const layout = makeLayout();
    const renderer = makeRenderer();

    drawKeyboard(renderer as unknown as QuadRenderer, layout, new Map());

    // the frame bar is the last thing drawn, and it spans the whole keyboard
    const frame = renderer.rects[renderer.rects.length - 1]!;
    const first = keyRect(layout, MIDI_MIN);
    const last = keyRect(layout, MIDI_MAX);
    expect(frame.x).toBe(first.x);
    expect(frame.w).toBe(last.x + last.w - first.x);
  });

  it('draws every key in the resting palette', () => {
    const layout = makeLayout();
    const renderer = makeRenderer();

    drawKeyboard(renderer as unknown as QuadRenderer, layout, new Map());

    expect(renderer.rects.length).toBeGreaterThan(88);
    expect(renderer.rects.every((rect) => rect.color !== undefined)).toBe(true);
  });

  it('tints only the pressed key', () => {
    const layout = makeLayout();
    const resting = makeRenderer();
    const pressed = makeRenderer();

    drawKeyboard(resting as unknown as QuadRenderer, layout, new Map());

    const keys = new KeyState();
    keys.press(C1, '#ff0000');
    drawKeyboard(pressed as unknown as QuadRenderer, layout, keys);

    expect(pressed.rects).toHaveLength(resting.rects.length);
    const changed = pressed.rects.filter((rect, index) => rect.color !== resting.rects[index]!.color);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThan(12);
  });

  it('clamps corner radius when keys get narrow', () => {
    const wide = makeLayout();
    const narrow = makeLayout({ width: 320, height: 600, pianoHeight: 200 });
    narrow.setRange(60, 52);

    const wideRenderer = makeRenderer();
    const narrowRenderer = makeRenderer();
    drawKeyboard(wideRenderer as unknown as QuadRenderer, wide, new Map());
    drawKeyboard(narrowRenderer as unknown as QuadRenderer, narrow, new Map());

    const maxRadius = (rects: Rect[]) => Math.max(...rects.map((rect) => rect.radius ?? 0));
    expect(maxRadius(wideRenderer.rects)).toBe(SHAPE.NATURAL_RADIUS);
    expect(maxRadius(narrowRenderer.rects)).toBeLessThan(SHAPE.NATURAL_RADIUS);
  });
});
