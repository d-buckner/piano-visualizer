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
import QuadRenderer from './QuadRenderer';
import { drawKeyboard, midiAt } from './keyboardLayers';

type Config = {
  container: HTMLElement;
  layout?: Layout;
  range?: Range;
  backgroundColor?: string;
  onKeyDown?: (midi: number) => void;
  onKeyUp?: (midi: number) => void;
};

export default class GLKeyboard {
  private canvas: HTMLCanvasElement;
  private renderer: QuadRenderer;
  private layout: Layout;
  private config: Config;
  private active = new Map<number, string>();
  private observer: ResizeObserver;
  private raf = 0;
  private frames = 0;
  private width = 0;
  private height = 0;
  private pointerMidi: number | null = null;
  private destroyed = false;

  constructor(config: Config) {
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
    this.bindPointer();

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

  public keyDown(midi: number, color = '#5dadec'): void {
    this.active.set(midi, color);
  }

  public keyUp(midi: number): void {
    this.active.delete(midi);
  }

  public setRange(centerMidi: number, visibleKeys: number): void {
    this.layout.setRange(centerMidi, visibleKeys);
  }

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
    this.renderer.destroy();
    this.canvas.remove();
  }

  private bindPointer(): void {
    const press = (clientX: number, clientY: number) => {
      const bounds = this.canvas.getBoundingClientRect();
      const midi = midiAt(this.layout, clientX - bounds.left, clientY - bounds.top);
      if (midi === null || midi === this.pointerMidi) {
        return;
      }
      this.release();
      this.pointerMidi = midi;
      this.config.onKeyDown?.(midi);
    };

    const release = () => this.release();

    this.canvas.addEventListener('pointerdown', (event) => {
      this.canvas.setPointerCapture(event.pointerId);
      press(event.clientX, event.clientY);
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (this.pointerMidi !== null) {
        press(event.clientX, event.clientY);
      }
    });
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('pointerleave', release);
  }

  private release(): void {
    if (this.pointerMidi === null) {
      return;
    }
    this.config.onKeyUp?.(this.pointerMidi);
    this.pointerMidi = null;
  }
}
