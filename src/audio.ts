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
export { default } from './audio/PianoAudio';
export { default as PianoAudio } from './audio/PianoAudio';
export type { PianoAudioConfig, AudioHandlers } from './audio/PianoAudio';

export { loadDPiano } from './audio/loadDPiano';
export type { Instrument, DPianoOptions } from './audio/loadDPiano';
