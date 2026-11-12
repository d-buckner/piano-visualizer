/**
 * just the piano roll: note blocks scrolling toward the keyboard.
 *
 * standalone host — owns a canvas, a resize observer and a raf loop, and draws
 * nothing but the roll. `pianoHeight` reserves the strip a host's own keyboard
 * occupies so blocks stop at the top of it rather than sliding underneath;
 * leave it 0 when the roll has the whole element to itself.
 *
 * it never owns note input or audio: state comes in through startNote/endNote.
 */
import Layout, { type Range } from './Layout.js';
import type { ActiveBlock } from './lib/ActiveBlock.js';
import NoteRoll from './lib/NoteRoll.js';
import QuadRenderer from './lib/QuadRenderer.js';

export type PianoRollConfig = {
  container: HTMLElement;
  /** height reserved for a keyboard drawn by the host below the roll */
  pianoHeight?: number;
  backgroundColor?: string;
  range?: Range;
};

export default class PianoRoll {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: QuadRenderer;
  private readonly layout: Layout;
  private readonly roll: NoteRoll;
  private readonly observer: ResizeObserver;
  private readonly config: PianoRollConfig;
  private raf = 0;
  private lastTime = 0;
  private frames = 0;
  private destroyed = false;

  constructor(config: PianoRollConfig) {
    this.config = config;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    config.container.append(this.canvas);

    this.renderer = new QuadRenderer(this.canvas);
    this.layout = new Layout({
      width: config.container.clientWidth,
      height: config.container.clientHeight,
      pianoHeight: config.pianoHeight ?? 0,
    });
    this.roll = new NoteRoll(this.layout);

    if (config.range) {
      this.layout.setRange(config.range.centerMidi, config.range.visibleKeys);
    }

    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(config.container);

    this.lastTime = performance.now();
    const loop = (now: number) => {
      if (this.destroyed) {
        return;
      }
      const deltaMS = now - this.lastTime;
      this.lastTime = now;
      this.render(deltaMS);
      this.frames += 1;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  public get frameCount(): number {
    return this.frames;
  }

  public get instanceCount(): number {
    return this.renderer.instances;
  }

  public startNote(midi: number, color: string, identifier?: string): void {
    this.roll.startNote(midi, color, identifier);
  }

  public endNote(midi: number, identifier?: string): void {
    this.roll.endNote(midi, identifier);
  }

  public getBlockPositions(): ActiveBlock[] {
    return this.roll.getBlockPositions();
  }

  public setRange(centerMidi: number, visibleKeys: number): void {
    this.layout.setRange(centerMidi, visibleKeys);
  }

  public getRange(): Range {
    return this.layout.getRange();
  }

  /**
   * No-op; the renderer rebuilds its instance buffer from state every frame, so
   * there is nothing to invalidate. Kept for API compatibility.
   */
  public forceRedraw(): void {}

  public resize(): void {
    const width = this.config.container.clientWidth;
    const height = this.config.container.clientHeight;

    this.layout.setWidth(width);
    this.layout.setHeight(height);
    this.renderer.resize(width, height);
  }

  public render(deltaMS = 16): void {
    this.renderer.begin(this.config.backgroundColor);
    this.roll.render(this.renderer, deltaMS);
    this.renderer.flush();
  }

  public destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.roll.destroy();
    this.renderer.destroy();
    this.canvas.remove();
  }
}
