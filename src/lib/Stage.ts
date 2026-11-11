/**
 * stage host - lets a module own its own pixi application.
 *
 * every renderable module in this package can be mounted two ways:
 * - embedded: the consumer hands us a pixi Container they already render. we
 *   draw into it and never touch the application lifecycle.
 * - standalone: the consumer hands us an HTMLElement. we create the Application,
 *   size it to the element, drive a ticker, and clean it all up on destroy.
 *
 * this is what makes "just the piano" or "just the piano roll" a real option
 * instead of a fork of the full visualizer.
 */
import { type ColorSource, type Ticker, Application, Container } from 'pixi.js';
import Layout from '../Layout';

export type MountTarget = HTMLElement | Container;

type PianoHeight = number | 'fill';

type Options = {
  container: HTMLElement;
  /** shared layout, for when a host drives sizing itself */
  layout?: Layout;
  /**
   * how much of the element height belongs to the keyboard. 'fill' makes the
   * keyboard take the whole box, which is what a standalone keyboard wants.
   */
  pianoHeight?: PianoHeight;
  backgroundColor?: ColorSource;
  onTick?: (ticker: Ticker) => void;
  onResize?: (layout: Layout) => void;
};

export type Mounted = {
  layout: Layout;
  /** where the module adds its own container */
  parent: Container;
  /** the stage we created, or null when embedded in someone else's scene */
  stage: Stage | null;
};

/**
 * resolve a module's mount target into a layout plus a parent container.
 * keeps the embedded/standalone branch in one place so every module behaves the
 * same way when handed an element instead of a container.
 */
export function mount(options: {
  name: string;
  container: MountTarget;
  layout?: Layout;
  pianoHeight?: PianoHeight;
  backgroundColor?: ColorSource;
  onTick: (ticker: Ticker) => void;
  onResize?: (layout: Layout) => void;
}): Mounted {
  const { container, name } = options;

  if (!isHTMLElement(container)) {
    if (!options.layout) {
      throw new Error(`${name}: layout is required when mounting into a pixi Container`);
    }

    return {
      layout: options.layout,
      parent: container,
      stage: null,
    };
  }

  const stage = new Stage({
    container,
    layout: options.layout,
    pianoHeight: options.pianoHeight,
    backgroundColor: options.backgroundColor,
    onTick: options.onTick,
    onResize: options.onResize,
  });

  return {
    layout: stage.layout,
    parent: stage.root,
    stage,
  };
}

/**
 * duck-typed on purpose. `container instanceof Container` is unreliable when a
 * consumer (or a test) hands us a mocked or duplicated pixi build, so we look
 * for DOM behaviour instead of a class identity.
 */
export function isHTMLElement(target: MountTarget): target is HTMLElement {
  if (typeof target !== 'object' || target === null) {
    return false;
  }

  const candidate = target as Partial<HTMLElement>;
  return typeof candidate.appendChild === 'function'
    && typeof candidate.ownerDocument === 'object';
}

export default class Stage {
  public readonly app: Application;
  public readonly root: Container;
  public readonly layout: Layout;
  private options: Options;
  private resizeObserver: ResizeObserver | null = null;
  private pianoHeight: PianoHeight;
  private destroyed = false;

  constructor(options: Options) {
    this.options = options;
    this.pianoHeight = options.pianoHeight ?? 'fill';

    const { container } = options;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.layout = options.layout ?? new Layout({
      width,
      height,
      pianoHeight: this.resolvePianoHeight(height),
    });

    this.app = new Application();
    this.root = new Container();
    this.app.resizeTo = container;

    this.init();
    this.observeResize();
  }

  /**
   * recompute sizing after the host element changed shape. the layout is the
   * single source of truth for key/roll geometry, so modules only need to know
   * that something moved.
   */
  public resize(width: number, height: number): void {
    if (this.destroyed || width <= 0 || height <= 0) {
      return;
    }

    this.layout.setWidth(width);
    this.layout.setHeight(height);

    if (this.ownsLayout()) {
      this.layout.updatePianoHeight(this.resolvePianoHeight(height));
    }

    this.options.onResize?.(this.layout);
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.options.onTick = undefined;
    this.options.onResize = undefined;
    this.app.destroy(true, { children: true });
  }

  private ownsLayout(): boolean {
    return !this.options.layout;
  }

  private resolvePianoHeight(height: number): number {
    if (this.pianoHeight === 'fill') {
      return height;
    }

    return Math.min(this.pianoHeight, height);
  }

  private observeResize(): void {
    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      this.resize(entry.contentRect.width, entry.contentRect.height);
    });
    this.resizeObserver.observe(this.options.container);
  }

  private async init(): Promise<void> {
    const { container, backgroundColor } = this.options;
    const options: Partial<import('pixi.js').ApplicationOptions> = {
      resizeTo: container,
    };

    if (backgroundColor === 'transparent') {
      options.backgroundAlpha = 0;
    } else if (backgroundColor !== undefined) {
      options.background = backgroundColor;
    }

    await this.app.init(options);
    if (this.destroyed) {
      return;
    }

    this.app.stage.addChild(this.root);
    if (this.options.onTick) {
      const onTick = this.options.onTick;
      this.app.ticker.add(onTick);
    }

    container.append(this.app.canvas);
  }
}
