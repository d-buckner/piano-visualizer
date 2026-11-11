import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import Stage, { mount, isHTMLElement } from './Stage';
import Layout from '../Layout';

const init = vi.fn().mockResolvedValue(undefined);

vi.mock('pixi.js', () => ({
  Application: vi.fn().mockImplementation(() => ({
    init,
    stage: { addChild: vi.fn() },
    ticker: { add: vi.fn() },
    canvas: document.createElement('canvas'),
    destroy: vi.fn(),
    resizeTo: null,
  })),
  Container: vi.fn().mockImplementation(() => ({
    addChild: vi.fn(),
    destroy: vi.fn(),
  })),
}));

describe('Stage', () => {
  beforeEach(() => {
    init.mockClear();
    globalThis.ResizeObserver = class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    } as unknown as typeof ResizeObserver;
  });

  const element = () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 200, configurable: true });
    return container;
  };

  describe('isHTMLElement', () => {
    it('recognises a dom element', () => {
      expect(isHTMLElement(document.createElement('div'))).toBe(true);
    });

    it('rejects a pixi container', () => {
      expect(isHTMLElement(new Container())).toBe(false);
    });
  });

  describe('mount', () => {
    it('creates a stage and a full-height keyboard layout for an element', () => {
      const mounted = mount({
        name: 'Piano',
        container: element(),
        onTick: vi.fn(),
      });

      expect(mounted.stage).toBeInstanceOf(Stage);
      expect(mounted.layout.getPianoHeight()).toBe(200);
      expect(mounted.layout.getPianoY()).toBe(0);
      expect(init).toHaveBeenCalled();
    });

    it('leaves room for the keyboard when asked', () => {
      const mounted = mount({
        name: 'PianoRoll',
        container: element(),
        pianoHeight: 0,
        onTick: vi.fn(),
      });

      expect(mounted.layout.getPianoRollHeight()).toBe(200);
    });

    it('reuses a layout the consumer already owns', () => {
      const layout = new Layout({ width: 1000, height: 600, pianoHeight: 250 });
      const mounted = mount({
        name: 'Piano',
        container: element(),
        layout,
        onTick: vi.fn(),
      });

      expect(mounted.layout).toBe(layout);
      expect(mounted.stage).toBeInstanceOf(Stage);
    });

    it('embeds into a pixi container without owning an application', () => {
      const container = new Container();
      const layout = new Layout({ width: 1000, height: 600, pianoHeight: 250 });
      const before = init.mock.calls.length;

      const mounted = mount({
        name: 'Piano',
        container,
        layout,
        onTick: vi.fn(),
      });

      expect(mounted.stage).toBeNull();
      expect(mounted.parent).toBe(container);
      expect(init.mock.calls.length).toBe(before);
    });

    it('refuses a pixi container with no layout to size against', () => {
      expect(() => mount({
        name: 'Piano',
        container: new Container(),
        onTick: vi.fn(),
      })).toThrow(/layout is required/);
    });
  });

  describe('resize', () => {
    it('reflows the layout and notifies the module', () => {
      const onResize = vi.fn();
      const stage = new Stage({ container: element(), onResize });

      stage.resize(1200, 300);

      expect(stage.layout.getWidth()).toBe(1200);
      expect(stage.layout.getPianoHeight()).toBe(300);
      expect(onResize).toHaveBeenCalledWith(stage.layout);
    });

    it('ignores a destroyed stage', () => {
      const onResize = vi.fn();
      const stage = new Stage({ container: element(), onResize });

      stage.destroy();
      stage.resize(1200, 300);

      expect(onResize).not.toHaveBeenCalled();
    });
  });
});
