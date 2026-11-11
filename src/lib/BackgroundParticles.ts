import { Color, Container, Graphics, type Ticker } from 'pixi.js';
import Layout from '../Layout';
import { desaturateColor } from './color';
import ParticleField, { type BlockRect, type ParticleDraw } from './particleField';
import type { ActiveBlock } from './ActiveBlock';

type Config = {
  layout: Layout;
  count?: number;
  getActiveBlocks?: () => ActiveBlock[];
};

/**
 * pixi drawer over the shared {@link ParticleField}. all the simulation lives in
 * the field; this only turns particles into circles.
 */
export default class BackgroundParticles {
  public readonly container: Container;
  private readonly graphics: Graphics;
  private readonly layout: Layout;
  private readonly field: ParticleField;
  private readonly getActiveBlocks?: () => ActiveBlock[];
  private lastLayoutX: number;

  constructor(config: Config) {
    this.layout = config.layout;
    this.getActiveBlocks = config.getActiveBlocks;
    this.lastLayoutX = this.layout.getX();

    this.container = new Container();
    this.container.interactiveChildren = false;
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);

    this.field = new ParticleField({
      width: this.layout.getWidth(),
      height: this.layout.getPianoRollHeight(),
      count: config.count,
      parseColor: (color) => {
        const [r, g, b] = new Color(color).toArray();
        return [r, g, b];
      },
      desaturate: desaturateColor,
    });
  }

  public render(ticker: Ticker): void {
    const width = this.layout.getWidth();
    const height = this.layout.getPianoRollHeight();
    const layoutX = this.layout.getX();
    const panDelta = layoutX - this.lastLayoutX;
    this.lastLayoutX = layoutX;

    const blocks: BlockRect[] = (this.getActiveBlocks?.() ?? []).map((block) => ({
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      color: block.color,
    }));

    this.graphics.clear();
    this.field.update({
      deltaMS: ticker.deltaMS,
      width,
      height,
      panDelta,
      blocks,
      emit: (particle) => this.drawParticle(particle),
    });
  }

  public destroy(): void {
    this.graphics.destroy();
  }

  private drawParticle({ x, y, radius, alpha, sparkle, r, g, b }: ParticleDraw): void {
    const color = rgbToHex(r, g, b);

    if (sparkle > 0) {
      this.graphics
        .circle(x, y, radius * (4.5 + sparkle * 2))
        .fill({ color, alpha: alpha * (0.09 + sparkle * 0.09) })
        .circle(x, y, radius * (2.2 + sparkle))
        .fill({ color, alpha: alpha * (0.22 + sparkle * 0.14) });
    }

    this.graphics.circle(x, y, radius).fill({
      color,
      alpha: Math.min(0.85, alpha * (1 + sparkle * 3.3)),
    });
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const ri = Math.round(Math.min(1, Math.max(0, r)) * 255);
  const gi = Math.round(Math.min(1, Math.max(0, g)) * 255);
  const bi = Math.round(Math.min(1, Math.max(0, b)) * 255);
  return `#${((ri << 16) | (gi << 8) | bi).toString(16).padStart(6, '0')}`;
}
