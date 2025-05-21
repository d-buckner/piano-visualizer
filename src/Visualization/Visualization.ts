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

const DEFAULT_COLOR = '#5dadec';

type KeyHandler = (midi: number) => void;

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
    this.htmlContainer.setAttribute(
      'style',
      'overscroll-behavior-x: none; user-select: none; position: absolute; width: 100%; height: 100%;'
    );
    this.app.resizeTo = config.container;
    this.renderContainer = new Container();
    this.layout = new Layout({
      width: config.container.clientWidth,
      height: config.container.clientHeight,
      pianoHeight: 250,
    });

    this.piano = new Piano({
      container: this.renderContainer,
      layout: this.layout,
      onKeyDown: (midi) => {
        this.config.onKeyDown?.(midi);
        this.startNote(midi, DEFAULT_COLOR);
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

    this.resizeObserver = new ResizeObserver(([{contentRect}]) => this.layout.setWidth(contentRect.width));
    this.resizeObserver.observe(config.container);
  }

  public startNote(midi: number, color: string, identifier?: string) {
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
      preference: 'webgpu',
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
    this.htmlContainer.appendChild(this.app.canvas);
    container.appendChild(this.htmlContainer);

    this.app.ticker.add((delta) => {
      this.piano.render();
      this.pianoRoll.render(delta);
      this.animateContainerX(delta);
    });
  }

  private animateContainerX(delta: Ticker) {
    const deltaX = this.containerTargetX - this.renderContainer.x;
    if (deltaX === 0) {
      this.layout.setX(this.renderContainer.x);
      return;
    }

    const step = delta.deltaMS;
    // magic snap speed divisor (lower is faster)
    const deltaDivisor = 600;
    const deltaPower = 1.5;

    // were entirely concerned about easing here
    if (deltaX >= 1) {
      this.renderContainer.x += Math.max(
        (step * Math.pow(deltaX, deltaPower)) / deltaDivisor,
        1,
      );
    }
    if (deltaX <= -1) {
      this.renderContainer.x -= Math.max(
        (step * Math.pow(Math.abs(deltaX), deltaPower)) / deltaDivisor,
        1,
      );
    }

    if (-1 < deltaX && deltaX < 1) {
      this.renderContainer.x = this.containerTargetX;
    }
  }
}
