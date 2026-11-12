/**
 * the composed experience: keyboard + piano roll + atmosphere, one constructor.
 *
 * every part is also importable on its own — './keyboard', './piano-roll',
 * './core', './audio'. the root barrel is a convenience: the package ships
 * per-file ESM with no side effects, so `import { Piano } from
 * 'piano-visualizer'` pulls in the keyboard and nothing else.
 */
export { default } from './Visualization/index.js';
export { default as Visualization } from './Visualization/index.js';
export type { VisualizationConfig } from './Visualization/Visualization.js';

export { default as Piano } from './Piano/index.js';
export type { PianoConfig } from './Piano/Piano.js';

export { default as PianoRoll } from './PianoRoll.js';
export type { PianoRollConfig } from './PianoRoll.js';

export { default as Layout, Section } from './Layout.js';
export type { Range } from './Layout.js';

export { default as Pitch } from './Pitch.js';

export { isWebGL2Supported, WebGL2UnavailableError } from './lib/webgl.js';
