/**
 * scrolling note blocks - renders the falling/rising note visualization.
 * animates blocks over time and cleans up off-screen graphics.
 * uses rounded rectangles with configurable colors and minimum heights.
 */
import { Container, Graphics, type Ticker } from 'pixi.js';
import Layout from './Layout';
import GraphicsPool from './lib/GraphicsPool';

const BORDER_COLOR = '#2d2e2e';
const MIN_BLOCK_HEIGHT = 8;
const ANIMATION_SPEED_FACTOR = 0.2;
const PARTIAL_PIXEL_SIZE = 1 / window.devicePixelRatio;

type Config = {
  container: Container;
  layout: Layout;
};

type Block = {
  isActive: boolean;
  graphics: Graphics;
  y: number;
  height: number;
  midi: number;
  color: string;
  identifier?: string;
  lastX?: number;
  lastY?: number;
  lastWidth?: number;
  lastHeight?: number;
  needsRedraw?: boolean;
};

type GraphicsOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  graphics?: Graphics;
};

const RADIUS = 2;

export default class PianoRoll {
  config: Config;
  container: Container;
  blocks: Map<number, Block[]> = new Map();
  private graphicsPool: GraphicsPool;

  constructor(config: Config) {
    this.config = config;
    this.container = new Container();
    this.graphicsPool = new GraphicsPool();
    this.config.container.addChild(this.container);
  }

  public startNote(midi: number, color: string, identifier?: string) {
    const element = this.config.layout.getRollElement(midi);
    const graphics = this.graphicsPool.get();
    this.updateGraphics({
      x: element.x,
      y: 0,
      width: element.width,
      height: 0,
      color,
      graphics,
    });

    const existingEntries = this.blocks.get(midi);
    if (!existingEntries) {
      this.blocks.set(midi, []);
    }
    this.blocks.get(midi)!.push({
      isActive: true,
      y: 0,
      height: 0,
      graphics,
      midi,
      color,
      identifier,
      needsRedraw: true,
    });
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
  }

  private renderMidiBlocks(blocks: Block[], ticker: Ticker) {
    const distance = ticker.deltaMS * ANIMATION_SPEED_FACTOR;
    // buffer for block indexes marked for deletion
    const blockDeletionBuffer: number[] = [];

    blocks.forEach((block) => {
      const element = this.config.layout.getRollElement(block.midi);
      const pianoRollHeight = this.config.layout.getPianoRollHeight();
      
      block.y -= distance;

      if (block.isActive) {
        block.height += distance;
        const x = element.x;
        const y = block.y + pianoRollHeight;
        const width = element.width;
        const height = block.height;
        
        // Only redraw if position or size changed significantly
        if (this.hasBlockChanged(block, x, y, width, height)) {
          
          block.graphics.clear();
          this.updateGraphics({
            x,
            y,
            width,
            height,
            color: block.color,
            graphics: block.graphics,
          });
          
          block.lastX = x;
          block.lastY = y;
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

      const x = element.x;
      const y = block.y + pianoRollHeight;
      const width = element.width;
      const height = Math.max(block.height, MIN_BLOCK_HEIGHT);
      
      // Only redraw if position or size changed significantly
      if (this.hasBlockChanged(block, x, y, width, height)) {
        
        block.graphics.clear();
        this.updateGraphics({
          x,
          y,
          width,
          height,
          color: block.color,
          graphics: block.graphics,
        });
        
        block.lastX = x;
        block.lastY = y;
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
      if (blocks.length === 1) {
        this.blocks.delete(block.midi);
        return;
      }
      blocks.splice(blockIndex, 1);
    }
  }

  private hasBlockChanged(block: Block, x: number, y: number, width: number, height: number): boolean {
    return block.needsRedraw || 
           Math.abs((block.lastX ?? 0) - x) >= PARTIAL_PIXEL_SIZE ||
           Math.abs((block.lastY ?? 0) - y) >= PARTIAL_PIXEL_SIZE ||
           Math.abs((block.lastWidth ?? 0) - width) >= PARTIAL_PIXEL_SIZE ||
           Math.abs((block.lastHeight ?? 0) - height) >= PARTIAL_PIXEL_SIZE;
  }

  private updateGraphics(options: GraphicsOptions) {
    const { graphics, x, y, width, height, color } = options;
    return (graphics ?? new Graphics())
      .roundRect(x, y, width, height, RADIUS)
      .fill(color)
      .stroke({
        width: 2,
        color: BORDER_COLOR,
      });
  }
}
