/**
 * scrolling note blocks - renders the falling/rising note visualization.
 * animates blocks over time and cleans up off-screen graphics.
 * uses rounded rectangles with configurable colors and minimum heights.
 */
import { Container, FillGradient, Graphics, type Ticker } from 'pixi.js';
import Layout from './Layout';
import GraphicsPool from './lib/GraphicsPool';
import { adjustColor } from './lib/color';
import type { ActiveBlock } from './lib/ActiveBlock';

const MIN_BLOCK_HEIGHT = 8;
const ANIMATION_SPEED_FACTOR = 0.2;
const PARTIAL_PIXEL_SIZE = 1 / window.devicePixelRatio;
const GLOW_EXPANSION = 6;
const GLOW_ALPHA = 0.32;
const GLOW_STEPS = 4;

type Config = {
  container: Container;
  layout: Layout;
};

type Block = {
  isActive: boolean;
  graphics: Graphics;
  glowGraphics: Graphics;
  y: number;
  height: number;
  midi: number;
  color: string;
  identifier?: string;
  lastX?: number;
  lastWidth?: number;
  lastHeight?: number;
  needsRedraw?: boolean;
};

type GraphicsOptions = {
  width: number;
  height: number;
  color: string;
  graphics?: Graphics;
};

type BlockLayout = {
  x: number;
  width: number;
};

const RADIUS = 5;

export default class PianoRoll {
  config: Config;
  container: Container;
  blocks: Map<number, Block[]> = new Map();
  private rootContainer: Container;
  private glowContainer: Container;
  private graphicsPool: GraphicsPool;
  private glowGraphicsPool: GraphicsPool;
  private blockGradientCache = new Map<string, FillGradient>();

  constructor(config: Config) {
    this.config = config;
    this.rootContainer = new Container();
    this.glowContainer = new Container();
    this.container = new Container();
    this.graphicsPool = new GraphicsPool();
    this.glowGraphicsPool = new GraphicsPool();
    this.rootContainer.addChild(this.glowContainer);
    this.rootContainer.addChild(this.container);
    this.config.container.addChild(this.rootContainer);
  }

  public startNote(midi: number, color: string, identifier?: string) {
    const element = this.config.layout.getRollElement(midi);
    const graphics = this.graphicsPool.get();
    const glowGraphics = this.glowGraphicsPool.get();
    graphics.x = element.x;
    graphics.y = this.config.layout.getPianoRollHeight();
    glowGraphics.x = element.x - GLOW_EXPANSION;
    glowGraphics.y = this.config.layout.getPianoRollHeight() - GLOW_EXPANSION;
    graphics.alpha = 1;
    glowGraphics.alpha = GLOW_ALPHA;
    this.updateGraphics({
      width: element.width,
      height: 0,
      color,
      graphics,
    });
    this.updateGlowGraphics(glowGraphics, element.width, 0, color);

    const existingEntries = this.blocks.get(midi);
    if (!existingEntries) {
      this.blocks.set(midi, []);
    }
    this.blocks.get(midi)!.push({
      isActive: true,
      y: 0,
      height: 0,
      graphics,
      glowGraphics,
      midi,
      color,
      identifier,
      lastX: element.x,
      lastWidth: element.width,
      lastHeight: 0,
      needsRedraw: true,
    });
    this.glowContainer.addChild(glowGraphics);
    this.container.addChild(graphics);
  }

  public endNote(midi: number, identifier?: string) {
    const blocks = this.blocks.get(midi);
    if (!blocks?.length) {
      return;
    }

    if (identifier) {
      for (const block of blocks) {
        if (identifier === block.identifier) {
          block.isActive = false;
        }
      }
      return;
    }

    for (const block of blocks) {
      if (block.isActive && !block.identifier) {
        block.isActive = false;
      }
    }
  }

  public render(ticker: Ticker) {
    this.blocks.forEach((midiBlocks) => {
      this.renderMidiBlocks(midiBlocks, ticker);
    });
  }

  public getBlockPositions(
    containerOffsetX: number,
  ): ActiveBlock[] {
    const result: ActiveBlock[] = [];
    const pianoRollHeight = this.config.layout.getPianoRollHeight();

    this.blocks.forEach((midiBlocks) => {
      for (const block of midiBlocks) {
        const screenY = block.graphics.y;
        const height = block.height;
        if (screenY + height < 0 || screenY > pianoRollHeight) continue;

        result.push({
          x: block.graphics.x + containerOffsetX,
          y: screenY,
          width: block.lastWidth ?? 0,
          height,
          color: block.color,
        });
      }
    });

    return result;
  }

  public forceRedraw() {
    this.blocks.forEach((midiBlocks) => {
      midiBlocks.forEach((block) => {
        block.needsRedraw = true;
      });
    });
  }

  public destroy() {
    this.graphicsPool.clear();
    this.glowGraphicsPool.clear();
    this.blockGradientCache.forEach((gradient) => gradient.texture.destroy());
    this.blockGradientCache.clear();
  }

  private renderMidiBlocks(blocks: Block[], ticker: Ticker) {
    const distance = ticker.deltaMS * ANIMATION_SPEED_FACTOR;
    // buffer for block indexes marked for deletion
    const blockDeletionBuffer: number[] = [];

    blocks.forEach((block) => {
      const pianoRollHeight = this.config.layout.getPianoRollHeight();

      block.y -= distance;

      if (block.isActive) {
        block.height += distance;
        const { x, width } = this.getBlockLayout(block);
        const height = block.height;
        const y = block.y + pianoRollHeight;

        this.updateBlockPosition(block, x, y);

        // Only redraw if geometry changed significantly
        if (this.hasBlockGeometryChanged(block, x, width, height)) {
          this.updateGraphics({
            width,
            height,
            color: block.color,
            graphics: block.graphics,
          });
          this.updateGlowGraphics(block.glowGraphics, width, height, block.color);

          block.lastX = x;
          block.lastWidth = width;
          block.lastHeight = height;
          block.needsRedraw = false;
        }
        return;
      }

      if (block.y + block.height + pianoRollHeight <= 0) {
        // block is offscreen and needs to be marked for later cleanup
        const blockIndex = blocks.findIndex((b) => b === block);
        blockDeletionBuffer.push(blockIndex);
        return;
      }

      const { x, width } = this.getBlockLayout(block);
      const y = block.y + pianoRollHeight;
      const height = Math.max(block.height, MIN_BLOCK_HEIGHT);
      this.updateBlockPosition(block, x, y);

      // Only redraw if geometry changed significantly
      if (this.hasBlockGeometryChanged(block, x, width, height)) {
        this.updateGraphics({
          width,
          height,
          color: block.color,
          graphics: block.graphics,
        });
        this.updateGlowGraphics(block.glowGraphics, width, height, block.color);

        block.lastX = x;
        block.lastWidth = width;
        block.lastHeight = height;
        block.needsRedraw = false;
      }
    });

    // flush buffer of blocks marked for removal (reverse iteration for safe deletion)
    for (let i = blockDeletionBuffer.length - 1; i >= 0; i--) {
      const blockIndex = blockDeletionBuffer[i];
      const block = blocks[blockIndex];
      if (!block) {
        continue;
      }
      this.graphicsPool.return(block.graphics);
      this.glowGraphicsPool.return(block.glowGraphics);
      if (blocks.length === 1) {
        this.blocks.delete(block.midi);
        return;
      }
      blocks.splice(blockIndex, 1);
    }
  }

  private getBlockLayout(block: Block): BlockLayout {
    if (!block.needsRedraw && block.lastX !== undefined && block.lastWidth !== undefined) {
      return {
        x: block.lastX,
        width: block.lastWidth,
      };
    }

    return this.config.layout.getRollElement(block.midi);
  }

  private updateBlockPosition(block: Block, x: number, y: number): void {
    block.graphics.x = x;
    block.graphics.y = y;
    block.glowGraphics.x = x - GLOW_EXPANSION;
    block.glowGraphics.y = y - GLOW_EXPANSION;
  }

  private hasBlockGeometryChanged(block: Block, x: number, width: number, height: number): boolean {
    return block.needsRedraw ||
           Math.abs((block.lastX ?? 0) - x) >= PARTIAL_PIXEL_SIZE ||
           Math.abs((block.lastWidth ?? 0) - width) >= PARTIAL_PIXEL_SIZE ||
           Math.abs((block.lastHeight ?? 0) - height) >= PARTIAL_PIXEL_SIZE;
  }

  private updateGraphics(options: GraphicsOptions) {
    const { graphics, width, height, color } = options;
    let fill: FillGradient | string = color;
    try {
      fill = this.getBlockGradient(color);
    } catch {
      // FillGradient requires canvas — fall back in test environments
    }
    return (graphics ?? new Graphics())
      .clear()
      .roundRect(0, 0, width, height, RADIUS)
      .fill(fill)
      .stroke({
        width: 1,
        color: adjustColor(color, -0.3),
      });
  }

  private getBlockGradient(color: string): FillGradient {
    const cached = this.blockGradientCache.get(color);
    if (cached) {
      return cached;
    }

    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: adjustColor(color, -0.18) },
        { offset: 0.35, color },
        { offset: 1, color: adjustColor(color, 0.12) },
      ],
    });
    gradient.buildLinearGradient();
    this.blockGradientCache.set(color, gradient);
    return gradient;
  }

  private updateGlowGraphics(graphics: Graphics, width: number, height: number, color: string): Graphics {
    graphics.clear();

    for (let i = 0; i < GLOW_STEPS; i++) {
      const t = i / (GLOW_STEPS - 1); // 0 = outermost, 1 = innermost
      const expansion = GLOW_EXPANSION * (1.2 - t * 0.75);
      const offset = GLOW_EXPANSION - expansion;
      const alpha = 0.025 + t * t * 0.16;

      graphics
        .roundRect(
          offset, offset,
          width + expansion * 2,
          height + expansion * 2,
          RADIUS + expansion,
        )
        .fill({ color, alpha });
    }

    return graphics;
  }

}
