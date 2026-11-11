import { describe, it, expect, vi, beforeEach } from 'vitest';
import PianoRoll from './piano-roll';
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
    roundRect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    x: 0,
    y: 0,
    alpha: 1,
  })),
  FillGradient: vi.fn().mockImplementation(() => ({
    addColorStop: vi.fn(),
    buildLinearGradient: vi.fn(),
    texture: { destroy: vi.fn() },
  })),
  Color: vi.fn().mockImplementation(() => ({
    toArray: vi.fn().mockReturnValue([1, 1, 1, 1]),
    toHex: vi.fn().mockReturnValue('#ffffff'),
  })),
}));

const makeElement = (width = 900, height = 500) => {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: height, configurable: true });
  return container;
};

const ticker = { deltaMS: 16 } as never;

describe('piano-roll entry (standalone)', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    } as unknown as typeof ResizeObserver;
  });

  it('gives the notes the whole element when it stands alone', () => {
    const roll = new PianoRoll({ container: makeElement(900, 500) });

    roll.startNote(60, '#00ff00');
    expect(roll.blocks.get(60)?.[0]).toBeDefined();
    roll.render(ticker);
  });

  it('takes an initial range and exposes range controls', () => {
    const roll = new PianoRoll({
      container: makeElement(),
      range: { centerMidi: 65, visibleKeys: 16 },
    });

    expect(roll.getRange()).toEqual({ centerMidi: 65, visibleKeys: 16 });

    roll.setCenterMidi(70);
    expect(roll.getCenterMidi()).toBe(70);
    expect(roll.getVisibleKeys()).toBe(16);
  });

  it('pans its own container when it owns the stage', () => {
    const expected = new Layout({ width: 900, height: 500, pianoHeight: 0 });
    expected.setRange(65, 16);

    const roll = new PianoRoll({
      container: makeElement(900, 500),
      range: { centerMidi: 65, visibleKeys: 16 },
    });
    roll.render({ deltaMS: 16 } as never);

    expect(roll['rootContainer'].x).toBeCloseTo(expected.getX());
  });

  it('tracks note state without owning input or audio', () => {
    const roll = new PianoRoll({ container: makeElement() });

    roll.startNote(64, '#ff0000', 'player-1');
    roll.endNote(64, 'player-1');
    expect(roll.blocks.get(64)?.[0].isActive).toBe(false);
  });

  it('destroys cleanly', () => {
    const roll = new PianoRoll({ container: makeElement() });
    roll.startNote(60, '#00ff00');
    expect(() => roll.destroy()).not.toThrow();
  });
});
