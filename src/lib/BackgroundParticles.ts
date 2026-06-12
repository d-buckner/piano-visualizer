import { Color, Container, Graphics, type Ticker } from 'pixi.js';
import Layout from '../Layout';
import { desaturateColor } from './color';
import type { ActiveBlock } from './ActiveBlock';

const PARTICLE_COLORS = ['#62d982', '#4d91ff', '#ef7cff', '#ffffff'] as const;

const INFLUENCE_RADIUS = 220;
const INFLUENCE_RADIUS_SQ = INFLUENCE_RADIUS * INFLUENCE_RADIUS;
const COLOR_BLEND_STRENGTH = 0.75;
const NOTE_DRIFT_STRENGTH = 0.0015;
const DRIFT_DAMPING = 0.96;
const ALPHA_BOOST = 1.5;
const RADIUS_BOOST = 1.24;
const SPEED_REDUCTION = 0.15;
const NOISE_SCALE = 0.0035;
const NOISE_SPEED = 0.00008;
const NOISE_FORCE = 0.0035;
const BREATH_SPEED = 0.0007;
const MIN_PARALLAX = 0.2;
const MAX_PARALLAX = 0.55;

type ParsedBlock = {
  x: number;
  y: number;
  width: number;
  height: number;
  r: number;
  g: number;
  b: number;
};

type Particle = {
  x: number;
  y: number;
  baseRadius: number;
  baseAlpha: number;
  speed: number;
  baseR: number;
  baseG: number;
  baseB: number;
  vx: number;
  vy: number;
  depth: number;
  phase: number;
  sparkle: number;
};

type NoteInfluence = {
  strength: number;
  driftX: number;
  r: number;
  g: number;
  b: number;
};

type ParticleAppearance = {
  color: string;
  alpha: number;
  radius: number;
};

type Config = {
  layout: Layout;
  count?: number;
  getActiveBlocks?: () => ActiveBlock[];
};

export default class BackgroundParticles {
  public readonly container: Container;
  private readonly graphics: Graphics;
  private readonly layout: Layout;
  private readonly particles: Particle[];
  private readonly getActiveBlocks?: () => ActiveBlock[];
  private readonly colorCache = new Map<string, [number, number, number]>();
  private seed = 42;
  private elapsedMS = 0;
  private lastLayoutX: number;

  constructor(config: Config) {
    this.layout = config.layout;
    this.getActiveBlocks = config.getActiveBlocks;
    this.container = new Container();
    this.container.interactiveChildren = false;
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.lastLayoutX = this.layout.getX();
    this.particles = Array.from(
      { length: config.count ?? 120 },
      (_, index) => this.createParticle(index),
    );
  }

  public render(ticker: Ticker): void {
    const width = this.layout.getWidth();
    const height = this.layout.getPianoRollHeight();
    const distanceFactor = ticker.deltaMS / 16.67;
    this.elapsedMS += ticker.deltaMS;
    this.applyPanParallax();

    const blocks = this.parseBlocks(this.getActiveBlocks?.() ?? []);

    this.graphics.clear();

    for (const particle of this.particles) {
      const influence = this.calculateNoteInfluence(particle, blocks);
      this.updateParticlePosition(
        particle,
        influence,
        distanceFactor,
        width,
        height,
      );
      this.drawParticle(particle, this.calculateAppearance(particle, influence));
    }
  }

  public destroy(): void {
    this.graphics.destroy();
  }

  private parseBlocks(blocks: ActiveBlock[]): ParsedBlock[] {
    return blocks.map((block) => {
      const [r, g, b] = this.parseColor(block.color);
      return {
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        r,
        g,
        b,
      };
    });
  }

  private calculateNoteInfluence(
    particle: Particle,
    blocks: ParsedBlock[],
  ): NoteInfluence {
    let strength = 0;
    let totalWeight = 0;
    let driftX = 0;
    let r = 0;
    let g = 0;
    let b = 0;

    for (const block of blocks) {
      const distanceSquared = this.distanceSquaredToBlock(particle, block);
      if (distanceSquared >= INFLUENCE_RADIUS_SQ) continue;

      const normalizedDistance = Math.sqrt(distanceSquared) / INFLUENCE_RADIUS;
      const weight = (1 - normalizedDistance) ** 2;
      const centerOffset = block.x + block.width / 2 - particle.x;

      totalWeight += weight;
      driftX += Math.sign(centerOffset) * weight;
      r += block.r * weight;
      g += block.g * weight;
      b += block.b * weight;
      strength = Math.max(strength, weight);
    }

    if (totalWeight === 0) {
      return { strength: 0, driftX: 0, r: 0, g: 0, b: 0 };
    }

    return {
      strength,
      driftX,
      r: r / totalWeight,
      g: g / totalWeight,
      b: b / totalWeight,
    };
  }

  private distanceSquaredToBlock(
    particle: Particle,
    block: ParsedBlock,
  ): number {
    const dx = Math.max(
      0,
      block.x - particle.x,
      particle.x - (block.x + block.width),
    );
    const dy = Math.max(
      0,
      block.y - particle.y,
      particle.y - (block.y + block.height),
    );
    return dx * dx + dy * dy;
  }

  private applyPanParallax(): void {
    const layoutX = this.layout.getX();
    const panDelta = layoutX - this.lastLayoutX;

    if (panDelta !== 0) {
      for (const particle of this.particles) {
        const parallax = MIN_PARALLAX
          + particle.depth * (MAX_PARALLAX - MIN_PARALLAX);
        particle.x += panDelta * parallax;
      }
    }

    this.lastLayoutX = layoutX;
  }

  private updateParticlePosition(
    particle: Particle,
    influence: NoteInfluence,
    distanceFactor: number,
    width: number,
    height: number,
  ): void {
    const [curlX, curlY] = this.sampleCurl(particle);
    const noiseForce = NOISE_FORCE * (0.45 + particle.depth * 0.55);
    const speedMultiplier = 1 - influence.strength * SPEED_REDUCTION;

    particle.vx = (
      particle.vx +
      curlX * noiseForce +
      influence.driftX * NOTE_DRIFT_STRENGTH
    ) * DRIFT_DAMPING;
    particle.vy = (particle.vy + curlY * noiseForce) * DRIFT_DAMPING;
    particle.x += particle.vx * distanceFactor;
    particle.y += (
      particle.vy - particle.speed * speedMultiplier
    ) * distanceFactor;

    if (particle.y < -4) {
      particle.y = height + this.random() * 24;
      particle.x = this.random() * width;
      particle.vx = 0;
      particle.vy = 0;
    }
    if (particle.x > width || particle.x < 0) {
      particle.x = particle.x > width ? 0 : width;
    }
  }

  private calculateAppearance(
    particle: Particle,
    influence: NoteInfluence,
  ): ParticleAppearance {
    const colorMix = Math.min(1, influence.strength * COLOR_BLEND_STRENGTH);
    const breath = 0.82 + Math.sin(
      this.elapsedMS * BREATH_SPEED * (0.7 + particle.depth * 0.5) +
      particle.phase,
    ) * 0.18;

    return {
      color: this.rgbToHex(
        particle.baseR + (influence.r - particle.baseR) * colorMix,
        particle.baseG + (influence.g - particle.baseG) * colorMix,
        particle.baseB + (influence.b - particle.baseB) * colorMix,
      ),
      alpha:
        particle.baseAlpha *
        (1 + influence.strength * ALPHA_BOOST) *
        breath,
      radius: particle.baseRadius * (
        1 + influence.strength * (RADIUS_BOOST - 1)
      ),
    };
  }

  private drawParticle(
    particle: Particle,
    appearance: ParticleAppearance,
  ): void {
    const { color, alpha, radius } = appearance;

    if (particle.sparkle > 0) {
      this.graphics
        .circle(particle.x, particle.y, radius * (4.5 + particle.sparkle * 2))
        .fill({ color, alpha: alpha * (0.09 + particle.sparkle * 0.09) })
        .circle(particle.x, particle.y, radius * (2.2 + particle.sparkle))
        .fill({ color, alpha: alpha * (0.22 + particle.sparkle * 0.14) });
    }

    this.graphics
      .circle(particle.x, particle.y, radius)
      .fill({
        color,
        alpha: Math.min(0.85, alpha * (1 + particle.sparkle * 3.3)),
      });
  }

  private sampleCurl(particle: Particle): [number, number] {
    const time = this.elapsedMS * NOISE_SPEED;
    const x = particle.x * NOISE_SCALE;
    const y = particle.y * NOISE_SCALE;
    const offset = 0.025;

    return [
      this.valueNoise(x, y + offset, time) - this.valueNoise(x, y - offset, time),
      this.valueNoise(x - offset, y, time) - this.valueNoise(x + offset, y, time),
    ];
  }

  private parseColor(color: string): [number, number, number] {
    let cached = this.colorCache.get(color);
    if (!cached) {
      const c = new Color(color);
      const [r, g, b] = c.toArray();
      cached = [r, g, b];
      this.colorCache.set(color, cached);
    }
    return cached;
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const ri = Math.round(Math.min(1, Math.max(0, r)) * 255);
    const gi = Math.round(Math.min(1, Math.max(0, g)) * 255);
    const bi = Math.round(Math.min(1, Math.max(0, b)) * 255);
    return `#${((ri << 16) | (gi << 8) | bi).toString(16).padStart(6, '0')}`;
  }

  private createParticle(index: number): Particle {
    const width = Math.max(1, this.layout.getWidth());
    const height = Math.max(1, this.layout.getPianoRollHeight());
    const colorHex = PARTICLE_COLORS[index % PARTICLE_COLORS.length];
    const baseColor = colorHex === '#ffffff' ? colorHex : desaturateColor(colorHex, 0.35);
    const [baseR, baseG, baseB] = this.parseColor(baseColor);
    const depth = 0.25 + this.random() * 0.75;

    return {
      x: this.random() * width,
      y: this.random() * height,
      baseRadius: (0.75 + this.random() * 1.55) * (0.55 + depth * 0.45),
      baseAlpha: (0.045 + this.random() * 0.12) * (0.6 + depth * 0.4),
      speed: (0.012 + this.random() * 0.028) * (0.5 + depth * 0.5),
      baseR,
      baseG,
      baseB,
      vx: 0,
      vy: 0,
      depth,
      phase: this.random() * Math.PI * 2,
      sparkle: this.random() > 0.72 ? 0.55 + this.random() * 0.45 : 0,
    };
  }

  private valueNoise(x: number, y: number, z: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const xf = x - xi;
    const yf = y - yi;
    const zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const w = zf * zf * (3 - 2 * zf);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const hash = (hx: number, hy: number, hz: number) => {
      let h = Math.imul(hx, 374761393)
        ^ Math.imul(hy, 668265263)
        ^ Math.imul(hz, 2147483647);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff * 2 - 1;
    };
    const x00 = lerp(hash(xi, yi, zi), hash(xi + 1, yi, zi), u);
    const x10 = lerp(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u);
    const x01 = lerp(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u);
    const x11 = lerp(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u);
    return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
  }

  private random(): number {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
}
