/**
 * colour parsing for the renderer, with no dependencies.
 *
 * `ColorInput` covers the surface hosts pass around - hex, rgb(),
 * hsl(), CSS colour names, 24-bit numbers and [r,g,b] arrays - because the
 * public `startNote(midi, color)` API has always accepted any of them and a
 * visualizer that silently draws white for `'gold'` hides a bug in the caller.
 * Unparseable input throws at the callsite instead.
 *
 * The named-colour table is the standard CSS set (148 names), stored as one
 * compact string and parsed lazily so a bundle that never sees a colour name
 * never pays for the map.
 */

export type RGBA = readonly [number, number, number, number];

/** what `startNote` and friends accept */
export type ColorInput = string | number | readonly number[];

const NAMED_COLORS =
  'alicebluef0f8ff,antiquewhitefaebd7,aqua00ffff,aquamarine7fffd4,azuref0ffff,beigef5f5dc,bisqueffe4c4,black000000,blanchedalmondffebcd,blue0000ff,blueviolet8a2be2,browna52a2a,burlywooddeb887,cadetblue5f9ea0,chartreuse7fff00,chocolated2691e,coralff7f50,cornflowerblue6495ed,cornsilkfff8dc,crimsondc143c,cyan00ffff,darkblue00008b,darkcyan008b8b,darkgoldenrodb8860b,darkgraya9a9a9,darkgreen006400,darkgreya9a9a9,darkkhakibdb76b,darkmagenta8b008b,darkolivegreen556b2f,darkorangeff8c00,darkorchid9932cc,darkred8b0000,darksalmone9967a,darkseagreen8fbc8f,darkslateblue483d8b,darkslategray2f4f4f,darkslategrey2f4f4f,darkturquoise00ced1,darkviolet9400d3,deeppinkff1493,deepskyblue00bfff,dimgray696969,dimgrey696969,dodgerblue1e90ff,firebrickb22222,floralwhitefffaf0,forestgreen228b22,fuchsiaff00ff,gainsborodcdcdc,ghostwhitef8f8ff,goldffd700,goldenroddaa520,gray808080,green008000,greenyellowadff2f,grey808080,honeydewf0fff0,hotpinkff69b4,indianredcd5c5c,indigo4b0082,ivoryfffff0,khakif0e68c,lavendere6e6fa,lavenderblushfff0f5,lawngreen7cfc00,lemonchiffonfffacd,lightblueadd8e6,lightcoralf08080,lightcyane0ffff,lightgoldenrodyellowfafad2,lightgrayd3d3d3,lightgreen90ee90,lightgreyd3d3d3,lightpinkffb6c1,lightsalmonffa07a,lightseagreen20b2aa,lightskyblue87cefa,lightslategray778899,lightslategrey778899,lightsteelblueb0c4de,lightyellowffffe0,lime00ff00,limegreen32cd32,linenfaf0e6,magentaff00ff,maroon800000,mediumaquamarine66cdaa,mediumblue0000cd,mediumorchidba55d3,mediumpurple9370db,mediumseagreen3cb371,mediumslateblue7b68ee,mediumspringgreen00fa9a,mediumturquoise48d1cc,mediumvioletredc71585,midnightblue191970,mintcreamf5fffa,mistyroseffe4e1,moccasinffe4b5,navajowhiteffdead,navy000080,oldlacefdf5e6,olive808000,olivedrab6b8e23,orangeffa500,orangeredff4500,orchidda70d6,palegoldenrodeee8aa,palegreen98fb98,paleturquoiseafeeee,palevioletreddb7093,papayawhipffefd5,peachpuffffdab9,perucd853f,pinkffc0cb,plumdda0dd,powderblueb0e0e6,purple800080,rebeccapurple663399,redff0000,rosybrownbc8f8f,royalblue4169e1,saddlebrown8b4513,salmonfa8072,sandybrownf4a460,seagreen2e8b57,seashellfff5ee,siennaa0522d,silverc0c0c0,skyblue87ceeb,slateblue6a5acd,slategray708090,slategrey708090,snowfffafa,springgreen00ff7f,steelblue4682b4,tand2b48c,teal008080,thistled8bfd8,tomatoff6347,turquoise40e0d0,violetee82ee,wheatf5deb3,whiteffffff,whitesmokef5f5f5,yellowffff00,yellowgreen9acd32';

const namedCache = new Map<string, RGBA>();
const stringCache = new Map<string, RGBA>();
let namedLoaded = false;

function loadNamed(): void {
  if (namedLoaded) {
    return;
  }
  namedLoaded = true;

  for (const entry of NAMED_COLORS.split(',')) {
    // each entry is `name` followed by six hex digits
    const name = entry.slice(0, entry.length - 6);
    const hex = entry.slice(entry.length - 6);
    namedCache.set(name, [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
      1,
    ]);
  }
}

/** parse any supported colour, or throw with the offending value */
export function parseColor(input: ColorInput): RGBA {
  const parsed = tryParseColor(input);
  if (!parsed) {
    throw new Error(
      `piano-visualizer: cannot parse colour ${JSON.stringify(input)}. ` +
      'Use a hex string, rgb()/hsl(), a CSS colour name, a 24-bit number or an [r,g,b] array.',
    );
  }
  return parsed;
}

export function tryParseColor(input: ColorInput): RGBA | null {
  if (typeof input === 'number') {
    return [
      ((input >> 16) & 255) / 255,
      ((input >> 8) & 255) / 255,
      (input & 255) / 255,
      1,
    ];
  }

  if (Array.isArray(input)) {
    if (input.length < 3 || input.some((channel) => typeof channel !== 'number')) {
      return null;
    }
    // array channels are already-normalised 0-1 floats
    return [
      clamp01(input[0]!),
      clamp01(input[1]!),
      clamp01(input[2]!),
      clamp01(input.length > 3 ? input[3]! : 1),
    ];
  }

  if (typeof input !== 'string') {
    return null;
  }

  const key = input.trim().toLowerCase();
  const cached = stringCache.get(key);
  if (cached) {
    return cached;
  }

  const parsed = parseString(key);
  if (parsed && stringCache.size < 1024) {
    stringCache.set(key, parsed);
  }
  return parsed;
}

function parseString(value: string): RGBA | null {
  if (value === 'transparent') {
    return [0, 0, 0, 0];
  }

  if (value[0] === '#') {
    return parseHex(value.slice(1));
  }

  const functional = value.match(/^(rgba?|hsla?)\(([^)]+)\)$/);
  if (functional) {
    return functional[1]!.startsWith('rgb')
      ? parseRgb(functional[2]!)
      : parseHsl(functional[2]!);
  }

  loadNamed();
  return namedCache.get(value) ?? null;
}

function parseHex(digits: string): RGBA | null {
  if (![3, 4, 6, 8].includes(digits.length)) {
    return null;
  }
  if (!/^[0-9a-f]+$/.test(digits)) {
    return null;
  }

  const step = digits.length <= 4 ? 1 : 2;
  const channels: number[] = [];
  for (let i = 0; i < digits.length; i += step) {
    const pair = step === 1 ? digits[i]!.repeat(2) : digits.slice(i, i + 2);
    channels.push(parseInt(pair, 16) / 255);
  }
  while (channels.length < 4) {
    channels.push(1);
  }
  return [channels[0]!, channels[1]!, channels[2]!, channels[3]!];
}

/**
 * accepts both `rgb(1, 2, 3, 0.5)` and the modern space form
 * `rgb(1 2 3 / 0.5)`; percentages are allowed on the channels.
 */
function parseRgb(body: string): RGBA | null {
  const [channels, slashAlpha] = splitChannels(body);
  if (channels.length < 3) {
    return null;
  }
  // `rgba(1, 2, 3, 0.5)` carries alpha as a fourth comma-separated channel,
  // `rgb(1 2 3 / 0.5)` carries it after a slash
  const alpha = slashAlpha ?? (channels.length > 3 ? channels[3]!.trim() : null);

  const parsed = channels.slice(0, 3).map((channel) => {
    const value = Number.parseFloat(channel);
    if (Number.isNaN(value)) {
      return NaN;
    }
    return channel.trim().endsWith('%') ? value / 100 : value / 255;
  });
  if (parsed.some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return [
    clamp01(parsed[0]!),
    clamp01(parsed[1]!),
    clamp01(parsed[2]!),
    alpha === null ? 1 : parseAlpha(alpha),
  ];
}

function parseHsl(body: string): RGBA | null {
  const [channels, slashAlpha] = splitChannels(body);
  if (channels.length < 3) {
    return null;
  }
  const alpha = slashAlpha ?? (channels.length > 3 ? channels[3]!.trim() : null);

  const hue = Number.parseFloat(channels[0]!);
  const saturation = Number.parseFloat(channels[1]!);
  const lightness = Number.parseFloat(channels[2]!);
  if ([hue, saturation, lightness].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  const h = ((hue % 360) + 360) % 360;
  const s = clamp01(saturation / 100);
  const l = clamp01(lightness / 100);

  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const huePrime = h / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const segment = Math.floor(huePrime) % 6;
  const [r1, g1, b1] = (
    [[chroma, x, 0], [x, chroma, 0], [0, chroma, x],
     [0, x, chroma], [x, 0, chroma], [chroma, 0, x]] as const
  )[segment]!;
  const match = l - chroma / 2;

  return [
    clamp01(r1 + match),
    clamp01(g1 + match),
    clamp01(b1 + match),
    alpha === null ? 1 : parseAlpha(alpha),
  ];
}

/** split `1, 2, 3, 0.5` or `1 2 3 / 0.5` into channels and optional alpha */
function splitChannels(body: string): [string[], string | null] {
  const [main, alpha] = body.split('/');
  const parts = main!.includes(',')
    ? main!.split(',')
    : main!.trim().split(/\s+/);

  return [
    parts.filter((part) => part.length > 0),
    alpha !== undefined ? alpha.trim() : null,
  ];
}

function parseAlpha(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return 1;
  }
  return clamp01(value.trim().endsWith('%') ? parsed / 100 : parsed);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * same contract as the old `lib/color.ts`: positive lightens toward white,
 * negative darkens toward black.
 */
export function adjustColor(color: ColorInput, factor: number): string {
  const [r, g, b] = parseColor(color);
  const scale = factor >= 0 ? factor : 1 + Math.max(-1, factor);

  const channel = (value: number) => {
    const next = factor >= 0 ? value + (1 - value) * scale : value * scale;
    return toHexByte(next);
  };

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** luma-weighted desaturation. */
export function desaturateColor(color: ColorInput, factor: number): string {
  const [r, g, b] = parseColor(color);
  const luma = r * 0.299 + g * 0.587 + b * 0.114;

  const channel = (value: number) => toHexByte(value + (luma - value) * factor);

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** 0-1 floats for shader attributes. */
export function toFloats(color: ColorInput, alpha = 1): RGBA {
  const [r, g, b, a] = parseColor(color);
  return [r, g, b, a * alpha];
}

function toHexByte(value: number): string {
  return Math.round(clamp01(value) * 255)
    .toString(16)
    .padStart(2, '0');
}
