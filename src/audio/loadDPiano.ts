/**
 * the only module in this package that touches d-piano, and therefore the only
 * one that pulls in Tone.js. it is reachable exclusively through the
 * 'piano-visualizer/audio' entry, so an app that only renders never downloads a
 * sampler it does not use.
 */
import { Piano, type PianoOptions } from 'd-piano';

/** the slice of d-piano this package drives */
export type Instrument = {
  keyDown(event: { midi: number; velocity?: number }): unknown;
  keyUp(event: { midi: number; velocity?: number }): unknown;
  pedalDown?(): unknown;
  pedalUp?(): unknown;
  stopAll?(options?: { releasePedal?: boolean }): unknown;
  toDestination?(): unknown;
  load?(): Promise<unknown>;
  dispose?(): unknown;
};

export type DPianoOptions = Partial<Pick<PianoOptions, 'velocities' | 'release' | 'pedal'>>;

/**
 * create and load a d-piano instance. samples are hosted, so there is no url
 * to configure; load() resolves as soon as the first velocity pass can play.
 */
export async function loadDPiano(options: DPianoOptions = {}): Promise<Instrument> {
  const piano = new Piano(options) as unknown as Instrument & { toDestination(): unknown };
  piano.toDestination?.();
  await piano.load?.();
  return piano;
}
