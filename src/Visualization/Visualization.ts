/**
 * main entry point - orchestrates the various components and manages the pixi application.
 * handles initialization, container positioning, animation loops, and cleanup.
 * attempts to use webgpu when available, falls back to webgl.
 */
import {
  type ApplicationOptions,
  type ColorSource,
  type Ticker,
  Application,
  Container,
} from 'pixi.js';
import Layout from '../Layout';
import Piano from '../Piano';
import PianoRoll from '../PianoRoll';
import VisualizationController from './VisualizationController';
import applyStyle from '../lib/applyStyle';
import Cursor from '../lib/Cursor';

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

export default class Visualization {
  private app: Application;
  private config: Config;
  private piano: Piano;
  private pianoRoll: PianoRoll;
  private layout: Layout;
  private htmlContainer: HTMLDivElement;
  private renderContainer: Container;
  private containerTargetX = 0;
  private resizeObserver: ResizeObserver;

  constructor(config: Config) {
    this.config = config;
    this.app = new Application();
    this.htmlContainer = document.createElement('div');
    Cursor.init(this.htmlContainer);
    this.app.resizeTo = config.container;
    this.renderContainer = new Container();
    this.layout = new Layout({
      width: config.container.clientWidth,
      height: config.container.clientHeight,
      pianoHeight: VIZ_CONFIG.DEFAULT_PIANO_HEIGHT,
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
    this.pianoRoll = new PianoRoll({
      container: this.renderContainer,
      layout: this.layout,
    });

    this.app.stage.addChild(this.renderContainer);
    this.init();

    this.resizeObserver = new ResizeObserver(([{ contentRect }]) => {
      this.layout.setWidth(contentRect.width);
      this.layout.setHeight(contentRect.height);
      
      // Immediately sync container position to prevent key shifting during resize
      this.renderContainer.x = this.layout.getX();
      this.containerTargetX = this.layout.getX();
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

  public destroy() {
    this.resizeObserver.disconnect();
    this.app.destroy();
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

    new VisualizationController({
      canvas: this.app.canvas,
      layout: this.layout,
      onContainerTargetXChange: (x) => (this.containerTargetX = x),
      onContainerXChange: (x) => (this.renderContainer.x = x),
    });
    this.htmlContainer.append(this.app.canvas);
    this.htmlContainer.id = applyStyle();
    container.append(this.htmlContainer);

    this.app.ticker.add((delta) => {
      this.piano.render();
      this.pianoRoll.render(delta);
      this.animateContainerX(delta);
    });
  }

  private animateContainerX({ deltaMS }: Ticker) {
    const deltaX = this.containerTargetX - this.renderContainer.x;
    if (deltaX === 0) {
      this.layout.setX(this.renderContainer.x);
      return;
    }

    // were entirely concerned about easing here
    if (deltaX >= 1) {
      this.renderContainer.x += this.getEasingX(deltaX, deltaMS);
      return;
    }

    if (deltaX <= -1) {
      this.renderContainer.x -= this.getEasingX(deltaX, deltaMS);
      return;
    }

    this.renderContainer.x = this.containerTargetX;
  }

  private getEasingX(deltaX: number, step: number): number {
    return Math.max(
      (step * Math.pow(Math.abs(deltaX), VIZ_CONFIG.EASING_X_DELTA_POW)) / VIZ_CONFIG.EASING_X_DELTA_DIVISOR,
      1
    );
  }
}
