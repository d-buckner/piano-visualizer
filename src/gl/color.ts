/**
 * colour helpers with no pixi dependency.
 *
 * `lib/color.ts` goes through pixi's `Color`, which would drag the whole
 * renderer into a pixi-free build. same semantics, ~30 lines, hex only.
 */

export type RGBA = readonly [number, number, number, number];

const cache = new Map<string, RGBA>();

export function parseColor(color: string): RGBA {
  const cached = cache.get(color);
  if (cached) {
    return cached;
  }

  const parsed = parse(color) ?? [1, 1, 1, 1];
  if (cache.size < 512) {
    cache.set(color, parsed);
  }

  return parsed;
}

function parse(color: string): RGBA | null {
  const hex = color.trim();

  if (hex[0] === '#') {
    const digits = hex.slice(1);
    const expand = digits.length === 3 || digits.length === 4;
    const step = expand ? 1 : 2;
    const channels: number[] = [];

    for (let i = 0; i < digits.length && channels.length < 4; i += step) {
      const pair = expand ? digits[i]!.repeat(2) : digits.slice(i, i + 2);
      channels.push(parseInt(pair, 16) / 255);
    }

    if (channels.length === 0 || channels.some((channel) => Number.isNaN(channel))) {
      return null;
    }

    while (channels.length < 4) {
      channels.push(1);
    }

    return [channels[0]!, channels[1]!, channels[2]!, channels[3]!];
  }

  const rgb = hex.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1]!.split(',').map((part) => Number.parseFloat(part));
    const scale = parts[0]! > 1 ? 255 : 1;

    return [
      parts[0]! / scale,
      parts[1]! / scale,
      parts[2]! / scale,
      parts.length > 3 ? parts[3]! : 1,
    ];
  }

  return null;
}

/**
 * same contract as `lib/color.ts`: positive lightens toward white, negative
 * darkens toward black.
 */
export function adjustColor(color: string, factor: number): string {
  const [r, g, b, a] = parseColor(color);
  const scale = factor >= 0 ? factor : 1 + Math.max(-1, factor);

  const channel = (value: number) => {
    const next = factor >= 0 ? value + (1 - value) * scale : value * scale;
    return Math.round(Math.max(0, Math.min(1, next)) * 255)
      .toString(16)
      .padStart(2, '0');
  };

  void a;
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** same contract as `lib/color.ts`: luma-weighted desaturation. */
export function desaturateColor(color: string, factor: number): string {
  const [r, g, b] = parseColor(color);
  const luma = r * 0.299 + g * 0.587 + b * 0.114;

  const channel = (value: number, channelLuma: number) =>
    Math.round(Math.max(0, Math.min(1, value + (channelLuma - value) * factor)) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${channel(r, luma)}${channel(g, luma)}${channel(b, luma)}`;
}

/** 0-1 floats for shader uniforms. */
export function toFloats(color: string, alpha = 1): RGBA {
  const [r, g, b, a] = parseColor(color);
  return [r, g, b, a * alpha];
}
