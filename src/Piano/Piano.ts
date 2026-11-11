/**
 * prototype: the keyboard drawn by QuadRenderer instead of pixi.
 *
 * standalone host - owns a canvas, a resize observer, a raf loop and pointer
 * input. the drawing itself lives in `keyboardLayers.ts` so the full-scene GL
 * host can reuse it. pointer input is plain arithmetic: keys are laid out by
 * formula, so hit testing is a containment scan and pixi's event system is not
 * needed.
 */
import Layout, { type Range } from '../Layout';
import KeyState from '../lib/keyState';
import KeyboardInput from '../lib/keyboardInput';
import QuadRenderer from '../lib/QuadRenderer';
import { drawKeyboard } from '../lib/keyboardLayers';

export type PianoConfig = {
  container: HTMLElement;
  layout?: Layout;
  range?: Range;
  backgroundColor?: string;
  onKeyDown?: (midi: number) => void;
  onKeyUp?: (midi: number) => void;
};

export default class Piano {
  private canvas: HTMLCanvasElement;
  private renderer: QuadRenderer;
  private layout: Layout;
  private config: PianoConfig;
  private active = new KeyState();
  private observer: ResizeObserver;
  private input: KeyboardInput;
  private raf = 0;
  private frames = 0;
  private width = 0;
  private height = 0;
  private destroyed = false;

  constructor(config: PianoConfig) {
    this.config = config;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    config.container.append(this.canvas);

    this.renderer = new QuadRenderer(this.canvas);
    this.layout = config.layout ?? new Layout({
      width: config.container.clientWidth,
      height: config.container.clientHeight,
      pianoHeight: config.container.clientHeight,
    });

    if (config.range && !config.layout) {
      this.layout.setRange(config.range.centerMidi, config.range.visibleKeys);
    }

    this.resize();

    this.input = new KeyboardInput({
      canvas: this.canvas,
      layout: this.layout,
      onKeyDown: (midi) => this.config.onKeyDown?.(midi),
      onKeyUp: (midi) => this.config.onKeyUp?.(midi),
    });

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(config.container);

    const loop = () => {
      if (this.destroyed) {
        return;
      }
      this.render();
      this.frames += 1;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** frames rendered so far, for the benchmark harness */
  public get frameCount(): number {
    return this.frames;
  }

  public get instanceCount(): number {
    return this.renderer.instances;
  }

  public keyDown(midi: number, color = '#5dadec', identifier?: string): void {
    this.active.press(midi, color, identifier);
  }

  public keyUp(midi: number, identifier?: string): void {
    this.active.release(midi, identifier);
  }

  public setRange(centerMidi: number, visibleKeys: number): void {
    this.layout.setRange(centerMidi, visibleKeys);
  }

  /**
   * No-op. The pixi renderer cached drawn graphics and needed to be told they
   * were stale; this one rebuilds its instance buffer from state every frame.
   * Kept so hosts written against the old API keep compiling.
   */
  public forceRedraw(): void {}

  public resize(): void {
    this.width = this.config.container.clientWidth;
    this.height = this.config.container.clientHeight;
    this.layout.setWidth(this.width);
    this.layout.setHeight(this.height);
    this.layout.updatePianoHeight(this.height);
    this.renderer.resize(this.width, this.height);
  }

  public render(): void {
    const renderer = this.renderer;

    renderer.begin(this.config.backgroundColor);
    drawKeyboard(renderer, this.layout, this.active);
    renderer.flush();
  }

  public destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.input.dispose();
    this.renderer.destroy();
    this.canvas.remove();
  }
}
