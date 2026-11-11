/**
 * the composed experience: keyboard + piano roll + atmosphere, one constructor.
 *
 * every part is also importable on its own — './keyboard', './piano-roll',
 * './core', './audio'. the root barrel is a convenience: the package ships
 * per-file ESM with no side effects, so `import { Piano } from
 * 'piano-visualizer'` pulls in the keyboard and nothing else.
 */
export { default } from './Visualization';
export { default as Visualization } from './Visualization';
export type { VisualizationConfig } from './Visualization/Visualization';

export { default as Piano } from './Piano';
export type { PianoConfig } from './Piano/Piano';

export { default as PianoRoll } from './PianoRoll';
export type { PianoRollConfig } from './PianoRoll';

export { default as Layout, Section } from './Layout';
export type { Range } from './Layout';

export { default as Pitch } from './Pitch';

export type { MountTarget } from './lib/Stage';
