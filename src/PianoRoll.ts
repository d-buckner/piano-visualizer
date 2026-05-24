/**
 * scrolling note blocks - renders the falling/rising note visualization.
 * animates blocks over time and cleans up off-screen graphics.
 * uses rounded rectangles with configurable colors and minimum heights.
 */
import { Container, Graphics, type Ticker } from 'pixi.js';
import Layout from './Layout';
import GraphicsPool from './lib/GraphicsPool';
import { adjustColor } from './lib/color';

const MIN_BLOCK_HEIGHT = 8;
const ANIMATION_SPEED_FACTOR = 0.2;
const PARTIAL_PIXEL_SIZE = 1 / window.devicePixelRatio;
const GLOW_EXPANSION = 6;
const TRAIL_ALPHA = 0.1;
const GLOW_ALPHA = 0.32;
const MIN_ALPHA = 0.05;
const MAX_TRAIL_HEIGHT = 110;

type Config = {
  container: Container;
  layout: Layout;
};

type Block = {
  isActive: boolean;
  graphics: Graphics;
  glowGraphics: Graphics;
  trailGraphics: Graphics;
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

const RADIUS = 5;

export default class PianoRoll {
  config: Config;
  container: Container;
  blocks: Map<number, Block[]> = new Map();
  private rootContainer: Container;
  private trailContainer: Container;
  private glowContainer: Container;
  private graphicsPool: GraphicsPool;
  private glowGraphicsPool: GraphicsPool;
  private trailGraphicsPool: GraphicsPool;

  constructor(config: Config) {
    this.config = config;
    this.rootContainer = new Container();
    this.trailContainer = new Container();
    this.glowContainer = new Container();
    this.container = new Container();
    this.graphicsPool = new GraphicsPool();
    this.glowGraphicsPool = new GraphicsPool();
    this.trailGraphicsPool = new GraphicsPool();
    this.rootContainer.addChild(this.trailContainer);
    this.rootContainer.addChild(this.glowContainer);
    this.rootContainer.addChild(this.container);
    this.config.container.addChild(this.rootContainer);
  }

  public startNote(midi: number, color: string, identifier?: string) {
    const element = this.config.layout.getRollElement(midi);
    const graphics = this.graphicsPool.get();
    const glowGraphics = this.glowGraphicsPool.get();
    const trailGraphics = this.trailGraphicsPool.get();
    graphics.x = element.x;
    graphics.y = this.config.layout.getPianoRollHeight();
    glowGraphics.x = element.x - GLOW_EXPANSION;
    glowGraphics.y = this.config.layout.getPianoRollHeight() - GLOW_EXPANSION;
    trailGraphics.x = element.x;
    trailGraphics.y = 0;
    this.updateGraphics({
      width: element.width,
      height: 0,
      color,
      graphics,
    });
    this.updateGlowGraphics(glowGraphics, element.width, 0, color);
    this.updateTrailGraphics(trailGraphics, element.width, 0, color);

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
      trailGraphics,
      midi,
      color,
      identifier,
      lastX: element.x,
      lastWidth: element.width,
      lastHeight: 0,
      needsRedraw: true,
    });
    this.trailContainer.addChild(trailGraphics);
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
    this.trailGraphicsPool.clear();
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
        this.updateBlockAlpha(block, y, height, pianoRollHeight);
        this.updateBlockTrail(block, width, y, height, pianoRollHeight);

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
      this.updateBlockAlpha(block, y, height, pianoRollHeight);
      this.updateBlockTrail(block, width, y, height, pianoRollHeight);
      
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
      this.trailGraphicsPool.return(block.trailGraphics);
      if (blocks.length === 1) {
        this.blocks.delete(block.midi);
        return;
      }
      blocks.splice(blockIndex, 1);
    }
  }

  private getBlockLayout(block: Block): { x: number; width: number } {
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
    block.trailGraphics.x = x;
  }

  private updateBlockTrail(
    block: Block,
    width: number,
    y: number,
    height: number,
    pianoRollHeight: number,
  ): void {
    const blockBottom = Math.min(pianoRollHeight, y + height);
    const trailHeight = Math.min(
      MAX_TRAIL_HEIGHT,
      Math.max(0, pianoRollHeight - blockBottom),
    );
    block.trailGraphics.y = blockBottom;
    this.updateTrailGraphics(block.trailGraphics, width, trailHeight, block.color);
  }

  private updateBlockAlpha(block: Block, y: number, height: number, pianoRollHeight: number): void {
    const alpha = Math.max(
      MIN_ALPHA,
      Math.min(1, (y + height) / Math.max(1, pianoRollHeight)),
    );
    block.graphics.alpha = alpha;
    block.glowGraphics.alpha = alpha * GLOW_ALPHA;
    block.trailGraphics.alpha = alpha * TRAIL_ALPHA;
  }

  private hasBlockGeometryChanged(block: Block, x: number, width: number, height: number): boolean {
    return block.needsRedraw || 
           Math.abs((block.lastX ?? 0) - x) >= PARTIAL_PIXEL_SIZE ||
           Math.abs((block.lastWidth ?? 0) - width) >= PARTIAL_PIXEL_SIZE ||
           Math.abs((block.lastHeight ?? 0) - height) >= PARTIAL_PIXEL_SIZE;
  }

  private updateGraphics(options: GraphicsOptions) {
    const { graphics, width, height, color } = options;
    return (graphics ?? new Graphics())
      .clear()
      .roundRect(0, 0, width, height, RADIUS)
      .fill(color)
      .stroke({
        width: 1,
        color: adjustColor(color, -0.3),
      });
  }

  private updateGlowGraphics(graphics: Graphics, width: number, height: number, color: string): Graphics {
    return graphics
      .clear()
      .roundRect(
        0,
        0,
        width + GLOW_EXPANSION * 2,
        height + GLOW_EXPANSION * 2,
        RADIUS + GLOW_EXPANSION,
      )
      .fill({ color, alpha: 0.36 })
      .roundRect(
        GLOW_EXPANSION * 0.45,
        GLOW_EXPANSION * 0.45,
        width + GLOW_EXPANSION * 1.1,
        height + GLOW_EXPANSION * 1.1,
        RADIUS + GLOW_EXPANSION * 0.7,
      )
      .fill({ color, alpha: 0.5 });
  }

  private updateTrailGraphics(graphics: Graphics, width: number, height: number, color: string): Graphics {
    const trailWidth = Math.max(1, width * 0.44);
    const x = (width - trailWidth) / 2;
    const radius = Math.min(8, trailWidth / 2);
    const fadeHeight = Math.max(0, height);

    return graphics
      .clear()
      .roundRect(x, 0, trailWidth, fadeHeight, radius)
      .fill({ color, alpha: 0.34 })
      .roundRect(x - trailWidth * 0.8, 0, trailWidth * 2.6, fadeHeight * 0.72, radius)
      .fill({ color, alpha: 0.08 })
      .roundRect(x - trailWidth * 0.35, 0, trailWidth * 1.7, fadeHeight * 0.42, radius)
      .fill({ color, alpha: 0.1 });
  }
}
