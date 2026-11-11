import { describe, it, expect } from 'vitest';
import { Color } from 'pixi.js';
import { parseColor, tryParseColor, adjustColor, desaturateColor } from './color';

const SAMPLES = ['#62d982', '#4d91ff', '#bd4ed8', '#f2c14e', '#ffffff', '#000000', '#101318'];

describe('parseColor', () => {
  it('parses every hex length', () => {
    expect(parseColor('#62d982')).toEqual([0x62 / 255, 0xd9 / 255, 0x82 / 255, 1]);
    expect(parseColor('#fff')).toEqual([1, 1, 1, 1]);
    expect(parseColor('#fff8')).toEqual([1, 1, 1, 0x88 / 255]);
    expect(parseColor('#ff000080')).toEqual([1, 0, 0, 0x80 / 255]);
  });

  it('parses rgb() in both syntaxes', () => {
    expect(parseColor('rgba(2, 4, 11, 0.7)')).toEqual([2 / 255, 4 / 255, 11 / 255, 0.7]);
    expect(parseColor('rgb(255 0 0 / 0.5)')).toEqual([1, 0, 0, 0.5]);
    expect(parseColor('rgb(100%, 0%, 0%)')).toEqual([1, 0, 0, 1]);
  });

  it('parses hsl()', () => {
    expect(parseColor('hsl(120, 100%, 50%)')).toEqual([0, 1, 0, 1]);
    expect(parseColor('hsl(0, 0%, 50%)')).toEqual([0.5, 0.5, 0.5, 1]);
    expect(parseColor('hsl(0 100% 50% / 0.5)')).toEqual([1, 0, 0, 0.5]);
    // hue wraps, so 480 behaves like 120
    expect(parseColor('hsl(480, 100%, 50%)')).toEqual([0, 1, 0, 1]);
  });

  it('parses CSS colour names', () => {
    expect(parseColor('gold')).toEqual([1, 0xd7 / 255, 0, 1]);
    expect(parseColor('REBECCAPURPLE')).toEqual([0x66 / 255, 0x33 / 255, 0x99 / 255, 1]);
    expect(parseColor('transparent')).toEqual([0, 0, 0, 0]);
  });

  it('parses numbers and arrays', () => {
    expect(parseColor(0xff0000)).toEqual([1, 0, 0, 1]);
    expect(parseColor([0, 1, 0])).toEqual([0, 1, 0, 1]);
    expect(parseColor([0, 0, 1, 0.5])).toEqual([0, 0, 1, 0.5]);
  });

  it('throws rather than silently rendering white', () => {
    expect(() => parseColor('not a colour')).toThrow(/cannot parse colour/);
    expect(tryParseColor('not a colour')).toBeNull();
    expect(tryParseColor('#gggggg')).toBeNull();
    expect(tryParseColor([1, 2])).toBeNull();
  });
});

describe('pixi parity', () => {
  // pixi is the reference implementation being replaced; this comparison is the
  // evidence that the swap does not change colours.
  const inputs: (string | number)[] = [
    ...SAMPLES,
    'gold',
    'rebeccapurple',
    'hsl(210, 60%, 50%)',
    'rgb(12, 240, 96)',
    0x3366cc,
  ];

  it('parses to the same channels as pixi Color', () => {
    for (const input of inputs) {
      const [r, g, b] = new Color(input as never).toArray();
      const mine = parseColor(input);
      expect(mine[0], String(input)).toBeCloseTo(r, 5);
      expect(mine[1], String(input)).toBeCloseTo(g, 5);
      expect(mine[2], String(input)).toBeCloseTo(b, 5);
    }
  });

  it('stays within one 8-bit step of the pixi helpers', () => {
    // pixi round-trips through its own Color object, so the two agree to
    // within 1/255 per channel rather than bit for bit
    const step = 1 / 255;

    for (const color of SAMPLES) {
      for (const factor of [-0.4, -0.18, 0.12, 0.3]) {
        const mine = parseColor(adjustColor(color, factor));
        const theirs = new Color(new Color(color).toArray().map((channel, index) => {
          if (index === 3) return channel;
          const next = factor >= 0
            ? channel + (1 - channel) * factor
            : channel * (1 + Math.max(-1, factor));
          return next;
        }) as never).toArray();

        mine.forEach((channel, index) => {
          expect(Math.abs(channel - theirs[index]!), `${color} ${factor}`)
            .toBeLessThanOrEqual(step + 1e-6);
        });
      }

      const [r, g, b] = parseColor(color);
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      const mine = parseColor(desaturateColor(color, 0.35));
      const sources = [r, g, b];
      sources.forEach((source, index) => {
        expect(Math.abs(mine[index]! - (source + (luma - source) * 0.35)), color)
          .toBeLessThanOrEqual(step + 1e-6);
      });
    }
  });
});
