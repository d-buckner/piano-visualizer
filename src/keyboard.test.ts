import { describe, it, expect, vi, beforeEach } from 'vitest';
import Piano from './keyboard';
import Layout from './Layout';

vi.mock('pixi.js', () => ({
  Application: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    stage: { addChild: vi.fn() },
    ticker: { add: vi.fn() },
    canvas: document.createElement('canvas'),
    destroy: vi.fn(),
  })),
  Container: vi.fn().mockImplementation(() => ({
    addChild: vi.fn(),
    removeChild: vi.fn(),
    destroy: vi.fn(),
    y: 0,
    filters: [],
  })),
  Graphics: vi.fn().mockImplementation(() => ({
    clear: vi.fn().mockReturnThis(),
    rect: vi.fn().mockReturnThis(),
    roundRect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
    on: vi.fn(),
    destroy: vi.fn(),
    eventMode: 'auto',
  })),
  FillGradient: vi.fn().mockImplementation(() => ({
    addColorStop: vi.fn(),
    buildLinearGradient: vi.fn(),
    texture: null,
  })),
  Color: vi.fn().mockImplementation(() => ({
    toArray: vi.fn().mockReturnValue([1, 1, 1, 1]),
    toHex: vi.fn().mockReturnValue('#ffffff'),
  })),
}));

vi.mock('./Piano/PianoController');

const makeElement = (width = 900, height = 180) => {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: height, configurable: true });
  return container;
};

describe('keyboard entry (standalone)', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    } as unknown as typeof ResizeObserver;
  });

  it('runs itself from a plain element, keyboard filling the box', () => {
    const piano = new Piano({ container: makeElement() });

    expect(piano.getRange().visibleKeys).toBeGreaterThan(0);
  });

  it('takes input callbacks as options rather than requirements', () => {
    expect(() => new Piano({ container: makeElement() })).not.toThrow();

    const onKeyDown = vi.fn();
    const piano = new Piano({ container: makeElement(), onKeyDown });
    piano.keyDown(60, '#ff0000');
    piano.render();
  });

  it('applies an initial range', () => {
    const piano = new Piano({
      container: makeElement(),
      range: { centerMidi: 72, visibleKeys: 12 },
    });

    expect(piano.getCenterMidi()).toBe(72);
    expect(piano.getVisibleKeys()).toBe(12);
  });

  it('pans its own container when it owns the stage', () => {
    // setRange computes a horizontal offset; a standalone keyboard has no host
    // container to carry it, so it must apply it itself
    const expected = new Layout({ width: 900, height: 180, pianoHeight: 180 });
    expected.setRange(72, 12);

    const piano = new Piano({
      container: makeElement(),
      range: { centerMidi: 72, visibleKeys: 12 },
    });

    expect(piano['container'].x).toBeCloseTo(expected.getX());
  });

  it('exposes range controls', () => {
    const piano = new Piano({ container: makeElement() });

    piano.setRange(48, 24);
    expect(piano.getRange()).toEqual({ centerMidi: 48, visibleKeys: 24 });

    piano.setVisibleKeys(36);
    expect(piano.getVisibleKeys()).toBe(36);
    expect(piano.getCenterMidi()).toBe(48);
  });

  it('destroys cleanly', () => {
    const piano = new Piano({ container: makeElement() });
    expect(() => piano.destroy()).not.toThrow();
  });
});
