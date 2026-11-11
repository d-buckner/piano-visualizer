/**
 * particle field - the renderer-agnostic half of the ambient background.
 *
 * the curl noise, depth parallax, note-colour influence and breathing are pure
 * simulation: no webgl, no drawing calls. it emits positions, sizes and colours
 * and the renderer decides how to put them on screen, so the simulation stays
 * testable without a GPU.
 */

export type BlockRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

/** returns 0-1 rgb channels */
export type ParseColor = (color: string) => readonly [number, number, number];

export type ParticleDraw = {
  x: number;
  y: number;
  radius: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  /** 0 for most particles; sparkles get halo rings */
  sparkle: number;
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

type ParsedBlock = {
  x: number;
  y: number;
  width: number;
  height: number;
  r: number;
  g: number;
  b: number;
};

type Config = {
  width: number;
  height: number;
  parseColor: ParseColor;
  desaturate: (color: string, factor: number) => string;
  count?: number;
};

type Frame = {
  deltaMS: number;
  width: number;
  height: number;
  panDelta: number;
  blocks: BlockRect[];
  emit: (particle: ParticleDraw) => void;
};

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

export default class ParticleField {
  private readonly particles: Particle[];
  private readonly parseColor: ParseColor;
  private readonly desaturate: (color: string, factor: number) => string;
  private readonly colorCache = new Map<string, readonly [number, number, number]>();
  private readonly draw: ParticleDraw;
  private seed = 42;
  private elapsedMS = 0;

  constructor(config: Config) {
    this.parseColor = config.parseColor;
    this.desaturate = config.desaturate;
    this.draw = { x: 0, y: 0, radius: 0, r: 0, g: 0, b: 0, alpha: 0, sparkle: 0 };

    this.particles = Array.from(
      { length: config.count ?? 120 },
      (_, index) => this.createParticle(index, config.width, config.height),
    );
  }

  public get count(): number {
    return this.particles.length;
  }

  /** advance the simulation and emit one record per visible particle */
  public update(frame: Frame): void {
    const { deltaMS, width, height, panDelta, blocks, emit } = frame;
    const distanceFactor = deltaMS / 16.67;
    this.elapsedMS += deltaMS;

    if (panDelta !== 0) {
      for (const particle of this.particles) {
        const parallax = MIN_PARALLAX + particle.depth * (MAX_PARALLAX - MIN_PARALLAX);
        particle.x += panDelta * parallax;
      }
    }

    const parsed = this.parseBlocks(blocks);

    for (const particle of this.particles) {
      const influence = this.calculateNoteInfluence(particle, parsed);
      this.updatePosition(particle, influence, distanceFactor, width, height);
      this.calculateAppearance(particle, influence, this.draw);
      emit(this.draw);
    }
  }

  private parseBlocks(blocks: BlockRect[]): ParsedBlock[] {
    return blocks.map((block) => {
      const [r, g, b] = this.resolve(block.color);
      return { x: block.x, y: block.y, width: block.width, height: block.height, r, g, b };
    });
  }

  /** parseColor is injected, so memoise here - this runs per block per frame */
  private resolve(color: string): readonly [number, number, number] {
    let cached = this.colorCache.get(color);
    if (!cached) {
      cached = this.parseColor(color);
      if (this.colorCache.size < 512) {
        this.colorCache.set(color, cached);
      }
    }
    return cached;
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

    return { strength, driftX, r: r / totalWeight, g: g / totalWeight, b: b / totalWeight };
  }

  private distanceSquaredToBlock(particle: Particle, block: ParsedBlock): number {
    const dx = Math.max(0, block.x - particle.x, particle.x - (block.x + block.width));
    const dy = Math.max(0, block.y - particle.y, particle.y - (block.y + block.height));
    return dx * dx + dy * dy;
  }

  private updatePosition(
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
      particle.vx + curlX * noiseForce + influence.driftX * NOTE_DRIFT_STRENGTH
    ) * DRIFT_DAMPING;
    particle.vy = (particle.vy + curlY * noiseForce) * DRIFT_DAMPING;
    particle.x += particle.vx * distanceFactor;
    particle.y += (particle.vy - particle.speed * speedMultiplier) * distanceFactor;

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

  /** writes into `out` instead of allocating, this runs 120x per frame */
  private calculateAppearance(
    particle: Particle,
    influence: NoteInfluence,
    out: ParticleDraw,
  ): void {
    const colorMix = Math.min(1, influence.strength * COLOR_BLEND_STRENGTH);
    const breath = 0.82 + Math.sin(
      this.elapsedMS * BREATH_SPEED * (0.7 + particle.depth * 0.5) + particle.phase,
    ) * 0.18;

    out.x = particle.x;
    out.y = particle.y;
    out.r = particle.baseR + (influence.r - particle.baseR) * colorMix;
    out.g = particle.baseG + (influence.g - particle.baseG) * colorMix;
    out.b = particle.baseB + (influence.b - particle.baseB) * colorMix;
    out.alpha = particle.baseAlpha * (1 + influence.strength * ALPHA_BOOST) * breath;
    out.radius = particle.baseRadius * (1 + influence.strength * (RADIUS_BOOST - 1));
    out.sparkle = particle.sparkle;
  }

  private createParticle(index: number, width: number, height: number): Particle {
    const colorHex = PARTICLE_COLORS[index % PARTICLE_COLORS.length]!;
    const baseColor = colorHex === '#ffffff' ? colorHex : this.desaturate(colorHex, 0.35);
    const [baseR, baseG, baseB] = this.parseColor(baseColor);
    const depth = 0.25 + this.random() * 0.75;

    return {
      x: this.random() * Math.max(1, width),
      y: this.random() * Math.max(1, height),
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
