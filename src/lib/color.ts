import { Color } from 'pixi.js';

export function adjustColor(color: string, factor: number): string {
  const pixiColor = new Color(color);
  const [r, g, b, a] = pixiColor.toArray();

  if (factor >= 0) {
    return new Color([
      r + (1 - r) * factor,
      g + (1 - g) * factor,
      b + (1 - b) * factor,
      a,
    ]).toHex();
  }

  const darkenFactor = Math.max(0, 1 + factor);
  return new Color([
    r * darkenFactor,
    g * darkenFactor,
    b * darkenFactor,
    a,
  ]).toHex();
}

export function desaturateColor(color: string, factor: number): string {
  const pixiColor = new Color(color);
  const [r, g, b, a] = pixiColor.toArray();
  const luma = r * 0.299 + g * 0.587 + b * 0.114;

  return new Color([
    r + (luma - r) * factor,
    g + (luma - g) * factor,
    b + (luma - b) * factor,
    a,
  ]).toHex();
}
