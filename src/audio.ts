/**
 * optional sound. separate entry on purpose: d-piano (and Tone.js behind it)
 * only enters the bundle when an app asks for audio.
 *
 * ```ts
 * import PianoAudio from 'piano-visualizer/audio';
 *
 * const audio = new PianoAudio();
 * const viz = new Visualization({ container, ...audio.handlers() });
 * ```
 *
 * or bring your own instrument and leave d-piano out of the graph entirely.
 */
export { default } from './audio/PianoAudio.js';
export { default as PianoAudio } from './audio/PianoAudio.js';
export type { PianoAudioConfig, AudioHandlers } from './audio/PianoAudio.js';

export { loadDPiano } from './audio/loadDPiano.js';
export type { Instrument, DPianoOptions } from './audio/loadDPiano.js';
