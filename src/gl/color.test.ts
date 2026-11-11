import { describe, it, expect } from 'vitest';
import { parseColor, adjustColor, desaturateColor } from './color';
import { adjustColor as pixiAdjust, desaturateColor as pixiDesaturate } from '../lib/color';

const SAMPLES = ['#62d982', '#4d91ff', '#bd4ed8', '#f2c14e', '#ffffff', '#000000', '#101318'];

describe('gl colour helpers', () => {
  it('parses hex to 0-1 floats', () => {
    expect(parseColor('#62d982')).toEqual([
      0x62 / 255,
      0xd9 / 255,
      0x82 / 255,
      1,
    ]);
  });

  it('parses short hex and rgba()', () => {
    expect(parseColor('#fff')).toEqual([1, 1, 1, 1]);
    expect(parseColor('rgba(2, 4, 11, 0.7)')).toEqual([2 / 255, 4 / 255, 11 / 255, 0.7]);
  });

  it('falls back to white rather than throwing on junk', () => {
    expect(parseColor('not a colour')).toEqual([1, 1, 1, 1]);
  });

  it('stays within one 8-bit step of the pixi helpers', () => {
    // pixi round-trips through its own Color object, so the two agree to
    // within 1/255 per channel rather than bit for bit
    const step = 1 / 255;

    for (const color of SAMPLES) {
      for (const factor of [-0.4, -0.18, 0.12, 0.3]) {
        const mine = parseColor(adjustColor(color, factor));
        const theirs = parseColor(pixiAdjust(color, factor));
        mine.forEach((channel, index) => {
          expect(Math.abs(channel - theirs[index]!), `${color} ${factor}`)
            .toBeLessThanOrEqual(step + 1e-6);
        });
      }

      const mine = parseColor(desaturateColor(color, 0.35));
      const theirs = parseColor(pixiDesaturate(color, 0.35));
      mine.forEach((channel, index) => {
        expect(Math.abs(channel - theirs[index]!), color).toBeLessThanOrEqual(step + 1e-6);
      });
    }
  });
});
