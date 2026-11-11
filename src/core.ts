/**
 * shared primitives: sizing geometry, colour parsing, capability checks.
 * nothing here renders a keyboard or a roll, so it is safe to depend on from
 * either side, or on its own when a host drives its own renderer.
 */
export { default as Layout, Section } from './Layout';
export type { Range } from './Layout';

export { default as Pitch } from './Pitch';

export { default as KeyState } from './lib/keyState';
export type { ActiveKey } from './lib/keyState';

export { adjustColor, desaturateColor, parseColor, tryParseColor } from './lib/color';
export type { RGBA } from './lib/color';

export { isWebGL2Supported, WebGL2UnavailableError } from './lib/webgl';

export type { ActiveBlock } from './lib/ActiveBlock';
