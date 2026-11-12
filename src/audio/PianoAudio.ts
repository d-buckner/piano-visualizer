/**
 * audio adapter - turns note on/off events into sound.
 *
 * deliberately decoupled from rendering: the visualizer knows nothing about
 * audio, and this knows nothing about rendering. they meet in the callbacks, which means
 * a consumer can drive sound from a MIDI interface, a score player, or the
 * on-screen keyboard without choosing a side.
 *
 * d-piano is an optional peer dependency. either inject your own instrument or
 * let this module lazy-load d-piano on first use.
 */
import { type DPianoOptions, type Instrument, loadDPiano } from './loadDPiano.js';

const DEFAULT_VELOCITY = 0.8;

export type PianoAudioConfig = {
  /** bring your own instrument (any d-piano shaped object) */
  instrument?: Instrument;
  /** d-piano options used when this class creates the instrument itself */
  piano?: DPianoOptions;
  /**
   * build the instrument yourself instead of using the bundled d-piano setup.
   * the seam for a custom tone context, sample url, or a different sampler.
   */
  createInstrument?: () => Instrument | Promise<Instrument>;
  /** start loading immediately (default) or wait for an explicit load() */
  autoLoad?: boolean;
  /** default note velocity, 0-1 */
  velocity?: number;
  /** per-note velocity, useful for humanised or velocity-aware input */
  getVelocity?: (midi: number) => number;
  /** resolved once the instrument can play */
  onReady?: () => void;
};

/**
 * shaped like Visualization's input handlers so it drops straight into the
 * composed visualizer or a standalone keyboard.
 */
export type AudioHandlers = {
  onKeyDown: (midi: number) => undefined;
  onKeyUp: (midi: number) => void;
};

export default class PianoAudio {
  private config: PianoAudioConfig;
  private instrument: Instrument | null;
  private loading: Promise<Instrument> | null = null;
  private ready = false;
  private disposed = false;
  /** notes pressed before the instrument could answer, replayed on ready */
  private pending = new Set<number>();

  constructor(config: PianoAudioConfig = {}) {
    this.config = config;
    this.instrument = config.instrument ?? null;

    if (this.instrument) {
      this.markReady();
    } else if (config.autoLoad !== false) {
      void this.load();
    }
  }

  public get isReady(): boolean {
    return this.ready;
  }

  /**
   * resolve the instrument and wait for samples. safe to call repeatedly; the
   * in-flight load is shared.
   */
  public load(): Promise<void> {
    if (!this.loading) {
      this.loading = this.instrument
        ? Promise.resolve(this.instrument)
        : Promise.resolve(this.config.createInstrument
          ? this.config.createInstrument()
          : loadDPiano(this.config.piano));
    }

    return this.loading.then((instrument) => {
      if (this.disposed) {
        return;
      }

      this.instrument = instrument;
      this.markReady();
    });
  }

  public async keyDown(midi: number, velocity?: number): Promise<void> {
    if (this.disposed) {
      return;
    }

    if (!this.ready) {
      this.pending.add(midi);
      await this.load();
      return;
    }

    this.instrument?.keyDown({ midi, velocity: this.resolveVelocity(midi, velocity) });
  }

  public keyUp(midi: number, velocity?: number): void {
    if (this.disposed) {
      return;
    }

    // released before it ever sounded: never let it start
    if (this.pending.delete(midi)) {
      return;
    }

    this.instrument?.keyUp({ midi, velocity: this.resolveVelocity(midi, velocity) });
  }

  public pedalDown(): void {
    this.instrument?.pedalDown?.();
  }

  public pedalUp(): void {
    this.instrument?.pedalUp?.();
  }

  public stopAll(): void {
    this.pending.clear();
    this.instrument?.stopAll?.();
  }

  /**
   * wire sound into a visualizer or keyboard in one line:
   * `new Visualization({ container, ...audio.handlers() })`
   */
  public handlers(): AudioHandlers {
    return {
      onKeyDown: (midi: number) => {
        void this.keyDown(midi);
        return undefined;
      },
      onKeyUp: (midi: number) => {
        this.keyUp(midi);
      },
    };
  }

  public destroy(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.pending.clear();
    this.instrument?.stopAll?.();
    this.instrument = null;
    this.loading = null;
  }

  private markReady(): void {
    if (this.ready) {
      return;
    }

    this.ready = true;
    this.config.onReady?.();
    this.flushPending();
  }

  /**
   * replay whatever was held while samples were still arriving, so the first
   * keypress on a cold page is not silently swallowed.
   */
  private flushPending(): void {
    if (!this.instrument || this.pending.size === 0) {
      return;
    }

    const held = [...this.pending];
    this.pending.clear();
    held.forEach((midi) => {
      this.instrument?.keyDown({ midi, velocity: this.resolveVelocity(midi) });
    });
  }

  private resolveVelocity(midi: number, velocity?: number): number {
    if (velocity !== undefined) {
      return velocity;
    }

    if (this.config.getVelocity) {
      return this.config.getVelocity(midi);
    }

    return this.config.velocity ?? DEFAULT_VELOCITY;
  }
}
