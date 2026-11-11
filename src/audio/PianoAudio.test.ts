import { describe, it, expect, vi } from 'vitest';
import PianoAudio from './PianoAudio';
import type { Instrument } from './loadDPiano';

type Event = { midi: number; velocity?: number };

const recorder = (instrument: Partial<Instrument> = {}) => {
  const attacks: Event[] = [];
  const releases: Event[] = [];

  return {
    attacks,
    releases,
    instrument: {
      keyDown: (event: Event) => attacks.push(event),
      keyUp: (event: Event) => releases.push(event),
      ...instrument,
    } as Instrument,
  };
};

describe('PianoAudio', () => {
  it('plays an injected instrument with a default velocity', () => {
    const { instrument, attacks, releases } = recorder();
    const audio = new PianoAudio({ instrument });

    void audio.keyDown(60);
    audio.keyUp(60);

    expect(attacks).toEqual([{ midi: 60, velocity: 0.8 }]);
    expect(releases).toEqual([{ midi: 60, velocity: 0.8 }]);
  });

  it('honours configured and per-call velocity', () => {
    const { instrument, attacks } = recorder();
    const audio = new PianoAudio({ instrument, velocity: 0.4 });

    void audio.keyDown(61);
    void audio.keyDown(62, 1);

    expect(attacks).toEqual([
      { midi: 61, velocity: 0.4 },
      { midi: 62, velocity: 1 },
    ]);
  });

  it('supports per-note velocity from the host', () => {
    const { instrument, attacks } = recorder();
    const audio = new PianoAudio({ instrument, getVelocity: (midi) => midi / 100 });

    void audio.keyDown(80);

    expect(attacks).toEqual([{ midi: 80, velocity: 0.8 }]);
  });

  it('bridges into the visualizer handler shape', () => {
    const { instrument, attacks, releases } = recorder();
    const handlers = new PianoAudio({ instrument }).handlers();

    expect(handlers.onKeyDown(64)).toBeUndefined();
    handlers.onKeyUp(64);

    expect(attacks).toHaveLength(1);
    expect(releases).toHaveLength(1);
  });

  it('replays notes held while samples were still arriving', async () => {
    let resolveLoad: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });
    const { instrument, attacks } = recorder({ load: () => gate });

    const audio = new PianoAudio({
      autoLoad: false,
      createInstrument: async () => {
        await instrument.load?.();
        return instrument;
      },
    });

    void audio.keyDown(72);
    void audio.keyDown(74);
    audio.keyUp(74); // released before it ever sounded: must not start
    resolveLoad();
    // drain the microtask chain the loader goes through
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(attacks.map((event) => event.midi)).toEqual([72]);
  });

  it('stays silent once destroyed', () => {
    const { instrument, attacks, releases } = recorder();
    const audio = new PianoAudio({ instrument });

    audio.destroy();
    void audio.keyDown(60);
    audio.keyUp(60);

    expect(attacks).toHaveLength(0);
    expect(releases).toHaveLength(0);
  });

  it('stops sustained notes', () => {
    const stopAll = vi.fn();
    const { instrument } = recorder({ stopAll });
    const audio = new PianoAudio({ instrument });

    audio.stopAll();
    expect(stopAll).toHaveBeenCalledTimes(1);

    audio.destroy();
    // destroy releases whatever is sounding, then lets go of the instrument
    expect(stopAll).toHaveBeenCalledTimes(2);

    audio.stopAll();
    expect(stopAll).toHaveBeenCalledTimes(2);
  });

  it('passes the pedal through when the instrument has one', () => {
    const pedalDown = vi.fn();
    const pedalUp = vi.fn();
    const { instrument } = recorder({ pedalDown, pedalUp });
    const audio = new PianoAudio({ instrument });

    audio.pedalDown();
    audio.pedalUp();

    expect(pedalDown).toHaveBeenCalled();
    expect(pedalUp).toHaveBeenCalled();
  });
});
