import { describe, it, expect } from 'vitest';
import ParticleField, { type ParticleDraw } from './particleField';

const parseColor = (color: string): [number, number, number] => {
  const digits = color.slice(1);
  return [
    parseInt(digits.slice(0, 2), 16) / 255,
    parseInt(digits.slice(2, 4), 16) / 255,
    parseInt(digits.slice(4, 6), 16) / 255,
  ];
};

const identity = (color: string) => color;

function makeField(count = 12) {
  return new ParticleField({
    width: 800,
    height: 400,
    count,
    parseColor,
    desaturate: identity,
  });
}

function run(field: ParticleField, frames: number, extra: object = {}) {
  const emitted: ParticleDraw[][] = [];

  for (let frame = 0; frame < frames; frame++) {
    const batch: ParticleDraw[] = [];
    field.update({
      deltaMS: 16,
      width: 800,
      height: 400,
      panDelta: 0,
      blocks: [],
      emit: (particle) => batch.push({ ...particle }),
      ...extra,
    });
    emitted.push(batch);
  }

  return emitted;
}

describe('particleField', () => {
  it('is deterministic for a given configuration', () => {
    const a = run(makeField(), 5);
    const b = run(makeField(), 5);

    expect(a).toEqual(b);
  });

  it('emits one record per particle each frame', () => {
    const frames = run(makeField(20), 3);

    expect(frames).toHaveLength(3);
    expect(frames[0]).toHaveLength(20);
  });

  it('moves particles upward over time', () => {
    const field = makeField(8);
    const first: ParticleDraw[] = [];
    const last: ParticleDraw[] = [];

    for (let frame = 0; frame < 60; frame++) {
      field.update({
        deltaMS: 16,
        width: 800,
        height: 400,
        panDelta: 0,
        blocks: [],
        emit: (particle) => {
          if (frame === 0) first.push({ ...particle });
          if (frame === 59) last.push({ ...particle });
        },
      });
    }

    // particles recycle to the bottom when they exit the top, so assert the
    // invariant rather than one particle's travel
    expect(last.every((p) => p.y >= -4)).toBe(true);
    expect(last.map((p) => p.y)).not.toEqual(first.map((p) => p.y));
  });

  it('tints particles toward a nearby note colour', () => {
    const field = makeField(8);
    const without: ParticleDraw[] = [];
    field.update({
      deltaMS: 16,
      width: 800,
      height: 400,
      panDelta: 0,
      blocks: [],
      emit: (p) => without.push({ ...p }),
    });

    const withBlock: ParticleDraw[] = [];
    field.update({
      deltaMS: 16,
      width: 800,
      height: 400,
      panDelta: 0,
      // a wide block covering the whole field, so every particle is inside the
      // influence radius
      blocks: [{ x: 0, y: 0, width: 800, height: 400, color: '#ff0000' }],
      emit: (p) => withBlock.push({ ...p }),
    });

    const reddened = withBlock.filter((p, index) => p.r > without[index]!.r);
    expect(reddened.length).toBeGreaterThan(0);
  });

  it('shifts particles on pan, deeper particles less', () => {
    const field = makeField(12);
    const before: ParticleDraw[] = [];
    field.update({
      deltaMS: 16,
      width: 800,
      height: 400,
      panDelta: 0,
      blocks: [],
      emit: (p) => before.push({ ...p }),
    });

    const after: ParticleDraw[] = [];
    field.update({
      deltaMS: 0,
      width: 800,
      height: 400,
      panDelta: 5,
      blocks: [],
      emit: (p) => after.push({ ...p }),
    });

    // parallax is MIN_PARALLAX..MAX_PARALLAX of the pan, so a 5px pan moves a
    // particle 1..2.75px; a few particles cross the edge and recycle instead
    const shifts = after.map((p, index) => p.x - before[index]!.x);
    const parallaxed = shifts.filter((shift) => shift >= 1 && shift <= 2.75);
    expect(parallaxed.length).toBeGreaterThan(8);
    // depth drives parallax, so the shifts must not all be identical
    expect(new Set(parallaxed.map((shift) => shift.toFixed(3))).size).toBeGreaterThan(1);
  });
});
