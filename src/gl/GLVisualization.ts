/**
 * the whole scene - backdrop, particles, note blocks, keyboard, fade - drawn by
 * one WebGL2 renderer in a single instanced draw call.
 *
 * this is the GL counterpart of `Visualization`, and deliberately reuses the
 * pixi-free pieces of it (`Layout`, `GestureAnimator`, `VisualizationController`)
 * so the comparison measures the renderer rather than a reimplementation of
 * input and easing.
 */
import Layout, { type Range } from '../Layout';
import GestureAnimator from '../lib/GestureAnimator';
import VisualizationController from '../Visualization/VisualizationController';
import GLParticles from './GLParticles';
import GLPianoRoll from './GLPianoRoll';
import QuadRenderer from './QuadRenderer';
import { drawKeyboard, midiAt } from './keyboardLayers';

const DEFAULT_COLOR = '#5dadec';
const DEFAULT_PIANO_HEIGHT = 250;
const EASING_X_DELTA_DIVISOR = 600;
const EASING_X_DELTA_POW = 1.5;

export type GLVisualizationConfig = {
  container: HTMLElement;
  backgroundColor?: string;
  onKeyDown?: (midi: number) => undefined | string;
  onKeyUp?: (midi: number) => void;
  /** diagnostics: restrict which layers draw, to isolate a visual difference */
  layers?: Partial<Record<'backdrop' | 'particles' | 'roll' | 'keyboard' | 'fade', boolean>>;
};

export default class GLVisualization {
  public readonly layout: Layout;
  private readonly config: GLVisualizationConfig;
  private readonly layers: Record<string, boolean>;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: QuadRenderer;
  private readonly particles: GLParticles;
  private readonly roll: GLPianoRoll;
  private readonly active = new Map<number, string>();
  private readonly gesture: GestureAnimator;
  private readonly observer: ResizeObserver;
  private controller: VisualizationController | null = null;
  private pointerMidi: number | null = null;
  private lastPan = 0;
  private raf = 0;
  private lastTime = 0;
  private destroyed = false;
  private frames = 0;

  constructor(config: GLVisualizationConfig) {
    this.config = config;
    this.layers = {
      backdrop: true,
      particles: true,
      roll: true,
      keyboard: true,
      fade: true,
      ...config.layers,
    };
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    config.container.append(this.canvas);

    this.renderer = new QuadRenderer(this.canvas);
    this.layout = new Layout({
      width: config.container.clientWidth,
      height: config.container.clientHeight,
      pianoHeight: DEFAULT_PIANO_HEIGHT,
    });

    this.particles = new GLParticles({
      width: this.layout.getWidth(),
      height: this.layout.getPianoRollHeight(),
    });
    this.roll = new GLPianoRoll(this.layout);
    this.lastPan = this.layout.getX();

    this.gesture = new GestureAnimator({
      onPositionChange: (x) => this.layout.setX(x),
      easing: {
        deltaPowtValue: EASING_X_DELTA_POW,
        deltaDivisor: EASING_X_DELTA_DIVISOR,
      },
    });

    this.bindPointer();
    this.bindController();

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(config.container);
    this.resize();

    this.lastTime = performance.now();
    const loop = () => {
      if (this.destroyed) {
        return;
      }
      const now = performance.now();
      const deltaMS = Math.min(64, now - this.lastTime);
      this.lastTime = now;
      this.renderFrame(deltaMS);
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

  public startNote(midi: number, color = DEFAULT_COLOR, identifier?: string): void {
    this.active.set(midi, color);
    this.roll.startNote(midi, color, identifier);
  }

  public endNote(midi: number, identifier?: string): void {
    this.active.delete(midi);
    this.roll.endNote(midi, identifier);
  }

  public setRange(centerMidi: number, visibleKeys: number): void {
    this.layout.setRange(centerMidi, visibleKeys);
  }

  public getRange(): Range {
    return this.layout.getRange();
  }

  public setCenterMidi(midi: number): void {
    this.layout.setCenterMidi(midi);
  }

  public getCenterMidi(): number {
    return this.layout.getCenterMidi();
  }

  public setVisibleKeys(visibleKeys: number): void {
    this.layout.setVisibleKeys(visibleKeys);
  }

  public getVisibleKeys(): number {
    return this.layout.getVisibleKeys();
  }

  public setWidthFactor(widthFactor: number): void {
    this.layout.setWidthFactor(widthFactor);
  }

  public getWidthFactor(): number {
    return this.layout.getWidthFactor();
  }

  public destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.controller?.dispose();
    this.controller = null;
    this.roll.destroy();
    this.renderer.destroy();
    this.canvas.remove();
  }

  private renderFrame(deltaMS: number): void {
    const renderer = this.renderer;
    const layout = this.layout;
    const ticker = { deltaMS } as never;

    renderer.begin(this.config.backgroundColor ?? '#020410');
    if (this.layers.backdrop) {
      this.drawBackdrop();
    }

    const pan = layout.getX();
    if (this.layers.particles) {
      this.particles.render(renderer, {
        deltaMS,
        width: layout.getWidth(),
        height: layout.getPianoRollHeight(),
        panDelta: pan - this.lastPan,
        blocks: this.roll.getBlockPositions(),
      });
    }
    this.lastPan = pan;

    if (this.layers.roll) {
      this.roll.render(renderer, deltaMS);
    }
    if (this.layers.keyboard) {
      drawKeyboard(renderer, layout, this.active);
    }
    if (this.layers.fade) {
      this.drawFade();
    }
    renderer.flush();

    this.gesture.animate(ticker);
  }

  private drawBackdrop(): void {
    const { layout, renderer } = this;
    const width = layout.getWidth();
    const height = layout.getHeight();
    const pianoY = layout.getPianoY();
    const edgeWidth = Math.max(80, width * 0.16);

    renderer.rect({
      x: 0, y: 0, w: width, h: height,
      color: '#02040b',
      gradient: '#010101',
      gradientMid: '#070911',
      gradientMidAt: 0.62,
    });

    renderer.rect({ x: 0, y: 0, w: edgeWidth, h: height, color: '#000000', alpha: 0.32 });
    renderer.rect({
      x: width - edgeWidth, y: 0, w: edgeWidth, h: height, color: '#000000', alpha: 0.32,
    });
    renderer.rect({
      x: 0, y: pianoY - 5, w: width, h: 8, color: '#111827', alpha: 0.7,
    });
  }

  /**
   * pixi paints this as a 1x256 sprite whose gradient reaches zero alpha at
   * 32% of the roll, so drawing a rect that stops there is exact rather than
   * approximating a fourth stop.
   */
  private drawFade(): void {
    const { layout, renderer } = this;
    const pianoY = layout.getPianoY();
    const stop = pianoY * 0.32;

    renderer.rect({
      x: 0, y: 0, w: layout.getWidth(), h: stop,
      color: 'rgba(2, 4, 11, 0.7)',
      gradient: 'rgba(2, 4, 11, 0)',
      gradientMid: 'rgba(2, 4, 11, 0.35)',
      gradientMidAt: 0.18 / 0.32,
    });
  }

  private resize(): void {
    const width = this.config.container.clientWidth;
    const height = this.config.container.clientHeight;
    this.layout.setWidth(width);
    this.layout.setHeight(height);
    this.layout.updatePianoHeight(DEFAULT_PIANO_HEIGHT);
    this.renderer.resize(width, height);
  }

  private bindController(): void {
    this.controller = new VisualizationController({
      canvas: this.canvas,
      layout: this.layout,
      onContainerTargetXChange: (x) => this.gesture.setTarget(x),
      onContainerXChange: (x) => this.gesture.setPosition(x),
      onWidthFactorChange: () => undefined,
      onWidthFactorTargetChange: () => undefined,
    });
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
      this.startNote(midi, this.config.onKeyDown?.(midi) ?? DEFAULT_COLOR);
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
    this.endNote(this.pointerMidi);
    this.pointerMidi = null;
  }
}
