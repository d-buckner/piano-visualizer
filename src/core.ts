/**
 * shared primitives: sizing/alignment geometry and the pixi stage host.
 * nothing here renders a keyboard or a roll, so it is safe to depend on from
 * either side, or on its own when a host drives its own scene graph.
 */
export { default as Layout, Section } from './Layout';
export type { Range } from './Layout';

export { default as Pitch } from './Pitch';

export { default as Stage, mount, isHTMLElement } from './lib/Stage';
export type { MountTarget, Mounted } from './lib/Stage';

export { default as GraphicsPool } from './lib/GraphicsPool';
export { adjustColor, desaturateColor } from './lib/color';
export type { ActiveBlock } from './lib/ActiveBlock';
