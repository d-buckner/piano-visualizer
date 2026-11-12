/**
 * particle field drawn by QuadRenderer.
 *
 * the simulation is the shared `lib/particleField`; this only turns particles
 * into circles, so the ambient background looks identical whichever renderer a
 * consumer ships.
 */
import ParticleField, { type BlockRect, type ParticleDraw } from './particleField.js';
import type QuadRenderer from './QuadRenderer.js';
import { desaturateColor, parseColor, type RGBA } from './color.js';

type Config = {
  width: number;
  height: number;
  count?: number;
};

type Frame = {
  deltaMS: number;
  width: number;
  height: number;
  panDelta: number;
  blocks: BlockRect[];
};

export default class Particles {
  private readonly field: ParticleField;
  /** reused every particle, avoids 120 tuple allocations per frame */
  private readonly rgba: [number, number, number, number] = [0, 0, 0, 1];

  constructor(config: Config) {
    this.field = new ParticleField({
      width: config.width,
      height: config.height,
      count: config.count,
      parseColor: (color) => {
        const [r, g, b] = parseColor(color);
        return [r, g, b];
      },
      desaturate: desaturateColor,
    });
  }

  public render(renderer: QuadRenderer, frame: Frame): void {
    this.field.update({
      ...frame,
      emit: (particle) => this.draw(renderer, particle),
    });
  }

  private draw(renderer: QuadRenderer, particle: ParticleDraw): void {
    const { x, y, radius, alpha, sparkle } = particle;
    const color: RGBA = this.setColor(particle);

    if (sparkle > 0) {
      renderer.circle(x, y, radius * (4.5 + sparkle * 2), color, alpha * (0.09 + sparkle * 0.09));
      renderer.circle(x, y, radius * (2.2 + sparkle), color, alpha * (0.22 + sparkle * 0.14));
    }

    renderer.circle(x, y, radius, color, Math.min(0.85, alpha * (1 + sparkle * 3.3)));
  }

  private setColor({ r, g, b }: ParticleDraw): RGBA {
    const rgba = this.rgba;
    rgba[0] = r;
    rgba[1] = g;
    rgba[2] = b;
    rgba[3] = 1;
    return rgba;
  }
}
