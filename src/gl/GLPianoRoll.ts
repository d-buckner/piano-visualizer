/**
 * scrolling note blocks drawn by QuadRenderer.
 *
 * the pixi roll keeps a Graphics and a glow Graphics per block, pools them, and
 * redraws a path whenever geometry moves by more than a partial pixel. none of
 * that survives here: a block is four instances (glow plus body) written into
 * the same buffer as everything else, so there is nothing to pool, nothing to
 * invalidate, and no per-block object churn beyond the block record itself.
 *
 * geometry, motion and the glow stack match `PianoRoll` exactly.
 */
import Layout from '../Layout';
import type { ActiveBlock } from '../lib/ActiveBlock';
import type QuadRenderer from './QuadRenderer';
import { adjustColor, parseColor, type RGBA } from './color';

const MIN_BLOCK_HEIGHT = 8;
const ANIMATION_SPEED_FACTOR = 0.2;
const GLOW_EXPANSION = 6;
const GLOW_ALPHA = 0.32;
const GLOW_STEPS = 4;
const RADIUS = 5;

const NO_STROKE: RGBA = [0, 0, 0, 0];

type Palette = {
  base: RGBA;
  top: RGBA;
  mid: RGBA;
  bottom: RGBA;
  stroke: RGBA;
};

type Block = {
  midi: number;
  y: number;
  height: number;
  isActive: boolean;
  color: string;
  identifier?: string;
};

type Placed = {
  block: Block;
  palette: Palette;
  x: number;
  y: number;
  width: number;
  height: number;
};

export default class GLPianoRoll {
  private readonly blocks = new Map<number, Block[]>();
  private readonly palettes = new Map<string, Palette>();
  private readonly placed: Placed[] = [];
  private readonly layout: Layout;

  constructor(layout: Layout) {
    this.layout = layout;
  }

  public get activeCount(): number {
    let total = 0;
    for (const list of this.blocks.values()) {
      total += list.length;
    }
    return total;
  }

  public startNote(midi: number, color: string, identifier?: string): void {
    const list = this.blocks.get(midi);
    if (!list) {
      this.blocks.set(midi, [{ midi, y: 0, height: 0, isActive: true, color, identifier }]);
      return;
    }
    list.push({ midi, y: 0, height: 0, isActive: true, color, identifier });
  }

  public endNote(midi: number, identifier?: string): void {
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

  /**
   * No-op; see GLKeyboard.forceRedraw.
   */
  public forceRedraw(): void {}

  public render(renderer: QuadRenderer, deltaMS: number): void {
    const panX = this.layout.getX();
    const rollHeight = this.layout.getPianoRollHeight();
    const distance = deltaMS * ANIMATION_SPEED_FACTOR;
    const placed = this.placed;
    placed.length = 0;

    for (const [midi, blocks] of this.blocks) {
      for (let index = blocks.length - 1; index >= 0; index--) {
        const block = blocks[index]!;
        block.y -= distance;

        if (!block.isActive && block.y + block.height + rollHeight <= 0) {
          blocks.splice(index, 1);
          continue;
        }

        if (block.isActive) {
          block.height += distance;
        }

        const element = this.layout.getRollElement(midi);
        const height = block.isActive
          ? block.height
          : Math.max(block.height, MIN_BLOCK_HEIGHT);
        const y = block.y + rollHeight;

        if (y + height < 0 || y > rollHeight) {
          continue;
        }

        placed.push({
          block,
          palette: this.palette(block.color),
          x: element.x + panX,
          y,
          width: element.width,
          height,
        });
      }
    }

    // glow under blocks, exactly like the two pixi containers
    for (const item of placed) {
      this.drawGlow(renderer, item);
    }
    for (const item of placed) {
      this.drawBlock(renderer, item);
    }
  }

  /** screen-space rects for the particle field's colour influence */
  public getBlockPositions(): ActiveBlock[] {
    const panX = this.layout.getX();
    const rollHeight = this.layout.getPianoRollHeight();
    const result: ActiveBlock[] = [];

    for (const [midi, blocks] of this.blocks) {
      const element = this.layout.getRollElement(midi);
      for (const block of blocks) {
        const y = block.y + rollHeight;
        const height = block.isActive
          ? block.height
          : Math.max(block.height, MIN_BLOCK_HEIGHT);
        if (y + height < 0 || y > rollHeight) continue;

        result.push({
          x: element.x + panX,
          y,
          width: element.width,
          height,
          color: block.color,
        });
      }
    }

    return result;
  }

  public destroy(): void {
    this.blocks.clear();
    this.placed.length = 0;
  }

  private drawGlow(renderer: QuadRenderer, { palette, x, y, width, height }: Placed): void {
    for (let step = 0; step < GLOW_STEPS; step++) {
      const t = step / (GLOW_STEPS - 1); // 0 = outermost, 1 = innermost
      const expansion = GLOW_EXPANSION * (1.2 - t * 0.75);
      const offset = GLOW_EXPANSION - expansion;
      const alpha = (0.025 + t * t * 0.16) * GLOW_ALPHA;

      renderer.push(
        x - GLOW_EXPANSION + offset,
        y - GLOW_EXPANSION + offset,
        width + expansion * 2,
        height + expansion * 2,
        RADIUS + expansion,
        0,
        alpha,
        palette.base,
        null,
        NO_STROKE,
      );
    }
  }

  private drawBlock(renderer: QuadRenderer, { palette, x, y, width, height }: Placed): void {
    renderer.push(
      x,
      y,
      width,
      height,
      RADIUS,
      1,
      1,
      palette.top,
      palette.bottom,
      palette.stroke,
      palette.mid,
      0.35,
    );
  }

  /**
   * the pixi block is a three-stop vertical gradient: darkened top, base at
   * 0.35, lightened bottom, with a colour-matched hairline.
   */
  private palette(color: string): Palette {
    let palette = this.palettes.get(color);
    if (!palette) {
      palette = {
        base: parseColor(color),
        top: parseColor(adjustColor(color, -0.18)),
        mid: parseColor(color),
        bottom: parseColor(adjustColor(color, 0.12)),
        stroke: parseColor(adjustColor(color, -0.3)),
      };
      if (this.palettes.size < 256) {
        this.palettes.set(color, palette);
      }
    }
    return palette;
  }
}
