/**
 * main entry point - orchestrates the various components and manages the pixi application.
 * handles initialization, container positioning, animation loops, and cleanup.
 * attempts to use webgpu when available, falls back to webgl.
 */
import {
  type ApplicationOptions,
  type ColorSource,
  Application,
  Container,
  FillGradient,
  Graphics,
  Sprite,
  Texture,
} from 'pixi.js';
import Layout from '../Layout';
import Piano from '../Piano';
import PianoRoll from '../PianoRoll';
import VisualizationController from './VisualizationController';
import applyStyle from '../lib/applyStyle';
import Cursor from '../lib/Cursor';
import GestureAnimator from '../lib/GestureAnimator';
import BackgroundParticles from '../lib/BackgroundParticles';

const VIZ_CONFIG = {
  DEFAULT_COLOR: '#5dadec',
  EASING_X_DELTA_DIVISOR: 600, // magic snap speed divisor (lower is faster)
  EASING_X_DELTA_POW: 1.5,
  DEFAULT_PIANO_HEIGHT: 250
} as const;

type KeyHandler = (midi: number) => undefined | string;

type Config = {
  container: HTMLElement;
  backgroundColor?: ColorSource;
  onKeyUp?: KeyHandler;
  onKeyDown?: KeyHandler;
};

type Range = {
  centerMidi: number;
  visibleKeys: number;
};

type PerfProbe = {
  frameWorkMs?: number[];
};

export default class Visualization {
  private app: Application;
  private config: Config;
  private piano: Piano;
  private pianoRoll: PianoRoll;
  private layout: Layout;
  private htmlContainer: HTMLDivElement;
  private renderContainer: Container;
  private sceneBackdrop: Graphics;
  private fadeOverlay: Sprite;
  private backgroundParticles: BackgroundParticles;
  private resizeObserver: ResizeObserver;
  private gestureAnimator: GestureAnimator;
  private controller: VisualizationController | null = null;

  constructor(config: Config) {
    this.config = config;
    this.app = new Application();
    this.htmlContainer = document.createElement('div');
    Cursor.init(this.htmlContainer);
    this.app.resizeTo = config.container;
    this.renderContainer = new Container();
    this.sceneBackdrop = new Graphics();
    this.fadeOverlay = new Sprite(this.createFadeTexture());
    this.fadeOverlay.eventMode = 'none';
    this.layout = new Layout({
      width: config.container.clientWidth,
      height: config.container.clientHeight,
      pianoHeight: VIZ_CONFIG.DEFAULT_PIANO_HEIGHT,
    });

    this.backgroundParticles = new BackgroundParticles({
      layout: this.layout,
    });
    this.pianoRoll = new PianoRoll({
      container: this.renderContainer,
      layout: this.layout,
    });
    this.piano = new Piano({
      container: this.renderContainer,
      layout: this.layout,
      onKeyDown: (midi) => {
        const color = this.config?.onKeyDown?.(midi);
        this.startNote(midi, color);
      },
      onKeyUp: (midi) => {
        this.config.onKeyUp?.(midi);
        this.endNote(midi);
      },
    });

    this.app.stage.addChild(this.sceneBackdrop);
    this.app.stage.addChild(this.backgroundParticles.container);
    this.app.stage.addChild(this.renderContainer);
    this.app.stage.addChild(this.fadeOverlay);
    
    this.gestureAnimator = new GestureAnimator({
      onPositionChange: (x) => {
        this.renderContainer.x = x;
        this.layout.setX(x);
      },
      easing: {
        deltaPowtValue: VIZ_CONFIG.EASING_X_DELTA_POW,
        deltaDivisor: VIZ_CONFIG.EASING_X_DELTA_DIVISOR,
      },
    });
    
    this.init();

    this.resizeObserver = new ResizeObserver(([{ contentRect }]) => {
      this.layout.setWidth(contentRect.width);
      this.layout.setHeight(contentRect.height);
      
      // Force redraw since layout changed
      this.pianoRoll.forceRedraw();
      this.piano.forceRedraw();
      this.drawSceneBackdrop();
      
      // Immediately sync container position to prevent key shifting during resize
      const newX = this.layout.getX();
      this.gestureAnimator.setPosition(newX);
      this.gestureAnimator.setTarget(newX);
    });
    this.resizeObserver.observe(config.container);
  }

  public startNote(
    midi: number,
    color: string = VIZ_CONFIG.DEFAULT_COLOR,
    identifier?: string,
  ) {
    this.pianoRoll.startNote(midi, color, identifier);
    this.piano.keyDown(midi, color, identifier);
  }

  public endNote(midi: number, identifier?: string) {
    this.pianoRoll.endNote(midi, identifier);
    this.piano.keyUp(midi, identifier);
  }

  public setRange(centerMidi: number, visibleKeys: number): void {
    // Use the Layout's setRange method which handles validation and positioning
    this.layout.setRange(centerMidi, visibleKeys);
    
    // Force redraw since positions changed
    this.pianoRoll.forceRedraw();
    this.piano.forceRedraw();
    
    // Sync the gesture animator to the new position
    const newX = this.layout.getX();
    this.gestureAnimator.setPosition(newX);
    this.gestureAnimator.setTarget(newX);
  }

  public getRange(): Range {
    return this.layout.getRange();
  }

  public setCenterMidi(midi: number): void {
    const currentRange = this.layout.getRange();
    this.setRange(midi, currentRange.visibleKeys);
  }

  public getCenterMidi(): number {
    return this.layout.getCenterMidi();
  }

  public setVisibleKeys(visibleKeys: number): void {
    const currentRange = this.layout.getRange();
    this.setRange(currentRange.centerMidi, visibleKeys);
  }

  public getVisibleKeys(): number {
    return this.layout.getVisibleKeys();
  }

  public setWidthFactor(widthFactor: number): void {
    this.layout.setWidthFactor(widthFactor);
    this.pianoRoll.forceRedraw();
    this.piano.forceRedraw();
  }

  public getWidthFactor(): number {
    return this.layout.getWidthFactor();
  }

  public destroy() {
    this.controller?.dispose();
    this.controller = null;
    this.resizeObserver.disconnect();
    this.pianoRoll.destroy();
    this.backgroundParticles.destroy();
    this.app.destroy();
  }

  private drawSceneBackdrop(): void {
    const width = this.layout.getWidth();
    const height = this.layout.getHeight();
    const pianoY = this.layout.getPianoY();
    const gradient = new FillGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#02040b');
    gradient.addColorStop(0.62, '#070911');
    gradient.addColorStop(1, '#010101');
    gradient.buildLinearGradient();

    this.sceneBackdrop.clear();
    this.sceneBackdrop.rect(0, 0, width, height).fill(gradient);

    const edgeWidth = Math.max(80, width * 0.16);
    this.sceneBackdrop.rect(0, 0, edgeWidth, height).fill({
      color: '#000000',
      alpha: 0.32,
    });
    this.sceneBackdrop.rect(width - edgeWidth, 0, edgeWidth, height).fill({
      color: '#000000',
      alpha: 0.32,
    });
    this.sceneBackdrop.rect(0, pianoY - 5, width, 8).fill({
      color: '#111827',
      alpha: 0.7,
    });

    this.fadeOverlay.width = width;
    this.fadeOverlay.height = pianoY;
  }

  private createFadeTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return Texture.from(canvas);
    }
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, 'rgba(2, 4, 11, 0.7)');
    gradient.addColorStop(0.18, 'rgba(2, 4, 11, 0.35)');
    gradient.addColorStop(0.32, 'rgba(2, 4, 11, 0)');
    gradient.addColorStop(1, 'rgba(2, 4, 11, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, 256);
    return Texture.from(canvas);
  }

  private async init() {
    const { container, backgroundColor } = this.config;
    const options: Partial<ApplicationOptions> = {
      resizeTo: container,
    };
    if (backgroundColor === 'transparent') {
      options.backgroundAlpha = 0;
    } else {
      options.background = backgroundColor;
    }

    await this.app.init(options);
    this.drawSceneBackdrop();

    this.controller = new VisualizationController({
      canvas: this.app.canvas,
      layout: this.layout,
      onContainerTargetXChange: (x) => {
        this.gestureAnimator.setTarget(x);
      },
      onContainerXChange: (x) => {
        this.gestureAnimator.setPosition(x);
      },
      onWidthFactorChange: () => {
        this.pianoRoll.forceRedraw();
        this.piano.forceRedraw();
      },
      onWidthFactorTargetChange: () => {
        this.pianoRoll.forceRedraw();
        this.piano.forceRedraw();
      },
    });
    this.htmlContainer.append(this.app.canvas);
    this.htmlContainer.id = applyStyle();
    container.append(this.htmlContainer);

    this.app.ticker.add((delta) => {
      const frameStart = performance.now();
      this.backgroundParticles.render(delta);
      this.piano.render();
      this.pianoRoll.render(delta);
      this.gestureAnimator.animate(delta);
      (globalThis as { __pianoVisualizerPerf?: PerfProbe }).__pianoVisualizerPerf
        ?.frameWorkMs?.push(performance.now() - frameStart);
    });
  }
}
