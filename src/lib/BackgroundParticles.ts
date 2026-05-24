import { Container, Graphics, type Ticker } from 'pixi.js';
import Layout from '../Layout';
import { desaturateColor } from './color';

const PARTICLE_COLORS = ['#62d982', '#4d91ff', '#ef7cff', '#ffffff'] as const;

type Particle = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  color: string;
};

type Config = {
  layout: Layout;
  count?: number;
};

export default class BackgroundParticles {
  public readonly container: Container;
  private readonly graphics: Graphics;
  private readonly layout: Layout;
  private readonly particles: Particle[];
  private seed = 42;

  constructor(config: Config) {
    this.layout = config.layout;
    this.container = new Container();
    this.container.interactiveChildren = false;
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.particles = Array.from(
      { length: config.count ?? 90 },
      (_, index) => this.createParticle(index),
    );
  }

  public render(ticker: Ticker): void {
    const width = this.layout.getWidth();
    const height = this.layout.getPianoRollHeight();
    const distanceFactor = ticker.deltaMS / 16.67;

    this.graphics.clear();

    for (const particle of this.particles) {
      particle.y -= particle.speed * distanceFactor;

      if (particle.y < -4) {
        particle.y = height + this.random() * 24;
        particle.x = this.random() * width;
      }

      if (particle.x > width) {
        particle.x = this.random() * width;
      }

      this.graphics
        .circle(particle.x, particle.y, particle.radius)
        .fill({ color: particle.color, alpha: particle.alpha });
    }
  }

  public destroy(): void {
    this.graphics.destroy();
  }

  private createParticle(index: number): Particle {
    const width = Math.max(1, this.layout.getWidth());
    const height = Math.max(1, this.layout.getPianoRollHeight());
    const color = PARTICLE_COLORS[index % PARTICLE_COLORS.length];

    return {
      x: this.random() * width,
      y: this.random() * height,
      radius: 0.7 + this.random() * 1.7,
      alpha: 0.035 + this.random() * 0.09,
      speed: 0.02 + this.random() * 0.035,
      color: color === '#ffffff' ? color : desaturateColor(color, 0.35),
    };
  }

  private random(): number {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
}
