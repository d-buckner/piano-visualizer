/**
 * shared primitives: sizing geometry, colour parsing, capability checks.
 * nothing here renders a keyboard or a roll, so it is safe to depend on from
 * either side, or on its own when a host drives its own renderer.
 */
export { default as Layout, Section } from './Layout.js';
export type { Range } from './Layout.js';

export { default as Pitch } from './Pitch.js';

export { default as KeyState } from './lib/keyState.js';
export type { ActiveKey } from './lib/keyState.js';

export { adjustColor, desaturateColor, parseColor, tryParseColor } from './lib/color.js';
export type { RGBA } from './lib/color.js';

export { isWebGL2Supported, WebGL2UnavailableError } from './lib/webgl.js';

export type { ActiveBlock } from './lib/ActiveBlock.js';
