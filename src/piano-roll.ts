/**
 * just the piano roll.
 *
 * renders note blocks scrolling over a shared keyboard geometry. it never owns
 * note input, room state, or audio scheduling — the consumer projects note
 * state in through startNote/endNote.
 */
export { default } from './PianoRoll';
export { default as PianoRoll } from './PianoRoll';
export type { PianoRollConfig } from './PianoRoll';
