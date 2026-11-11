import { describe, it, expect } from 'vitest';
import { parseColor, tryParseColor, adjustColor, desaturateColor } from './color';

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

describe('golden values', () => {
  // frozen from the pixi Color implementation this parser replaced, so the
  // reference cannot drift the way a live comparison would.
  const GOLDEN = {
    '#62d982': [0.384314, 0.850980, 0.509804],
    '#4d91ff': [0.301961, 0.568627, 1.000000],
    '#bd4ed8': [0.741176, 0.305882, 0.847059],
    '#f2c14e': [0.949020, 0.756863, 0.305882],
    '#ffffff': [1.000000, 1.000000, 1.000000],
    '#000000': [0.000000, 0.000000, 0.000000],
    '#101318': [0.062745, 0.074510, 0.094118],
    gold: [1.000000, 0.843137, 0.000000],
    rebeccapurple: [0.400000, 0.200000, 0.600000],
    'hsl(210, 60%, 50%)': [0.200000, 0.500000, 0.800000],
    'rgb(12, 240, 96)': [0.047059, 0.941176, 0.376471],
    0x3366cc: [0.200000, 0.400000, 0.800000],
  };

  it('parses each input to the frozen channels', () => {
    for (const [input, expected] of Object.entries(GOLDEN)) {
      const parsed = parseColor(/^\d+$/.test(input) ? Number(input) : input);
      expected.forEach((channel, index) => {
        expect(parsed[index], `${input} channel ${index}`).toBeCloseTo(channel, 5);
      });
    }
  });

  it('lightens, darkens and desaturates within one step of the frozen hex', () => {
    const ADJUST = {
      '#62d982': { light: '#91e4a7', dark: '#3a824e', desat: '#7bc990' },
      '#4d91ff': { light: '#82b2ff', dark: '#2e5799', desat: '#628ed5' },
      '#bd4ed8': { light: '#d083e3', dark: '#712e81', desat: '#a75fb8' },
      '#f2c14e': { light: '#f5d383', dark: '#91732e', desat: '#e1c176' },
      '#101318': { light: '#57595d', dark: '#090b0e', desat: '#101216' },
    };

    // compared one channel at a time with a one-step tolerance: the reference
    // round-tripped through its own colour object, so the two land on opposite
    // sides of a rounding boundary now and then (167.49999997 rounds down)
    const withinOneStep = (mine: string, theirs: string, label: string) => {
      const a = parseColor(mine);
      const b = parseColor(theirs);
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(a[i]! - b[i]!), `${label} -> ${mine} vs ${theirs}`)
          .toBeLessThanOrEqual(1 / 255 + 1e-6);
      }
    };

    for (const [color, expected] of Object.entries(ADJUST)) {
      withinOneStep(adjustColor(color, 0.3), expected.light, `${color} +0.3`);
      withinOneStep(adjustColor(color, -0.4), expected.dark, `${color} -0.4`);
      withinOneStep(desaturateColor(color, 0.35), expected.desat, `${color} desat`);
    }
  });

  it('clamps instead of wrapping at the ends of the range', () => {
    expect(adjustColor('#ffffff', 0.5)).toBe('#ffffff');
    expect(adjustColor('#000000', -0.5)).toBe('#000000');
    expect(desaturateColor('#ffffff', 0.5)).toBe('#ffffff');
  });
});
