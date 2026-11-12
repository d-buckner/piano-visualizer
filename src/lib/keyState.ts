/**
 * Which keys are currently pressed, and in what colour.
 *
 * Renderer-agnostic on purpose, and it keeps a *stack* per key rather than a
 * single value: the same note can be held by several independent sources — two
 * fingers, a MIDI controller plus an on-screen key, an autoplay voice layered
 * over a live one. Releasing one must reveal the colour of whatever is still
 * holding the key rather than silencing it.
 */

export type ActiveKey = {
  color: string;
  midi: number;
  identifier?: string;
};

export const MIDI_MIN = 21;
export const MIDI_MAX = 108;

export default class KeyState {
  private readonly entries = new Map<number, ActiveKey[]>();

  public static isValidMidi(midi: number): boolean {
    if (midi < MIDI_MIN || midi > MIDI_MAX) {
      console.warn(`Invalid MIDI note: ${midi}. Valid range is ${MIDI_MIN}-${MIDI_MAX}`);
      return false;
    }
    return true;
  }

  public press(midi: number, color: string, identifier?: string): void {
    if (!KeyState.isValidMidi(midi)) {
      return;
    }

    const stack = this.entries.get(midi);
    if (stack) {
      stack.push({ color, midi, identifier });
      return;
    }
    this.entries.set(midi, [{ color, midi, identifier }]);
  }

  /**
   * Without an identifier this releases the most recent press, matching the
   * documented behaviour of the original keyboard.
   */
  public release(midi: number, identifier?: string): void {
    if (!KeyState.isValidMidi(midi)) {
      return;
    }

    const stack = this.entries.get(midi);
    if (!stack?.length) {
      return;
    }

    if (!identifier) {
      stack.pop();
    } else {
      const index = stack.findIndex((entry) => entry.identifier === identifier);
      if (index === -1) {
        return;
      }
      stack.splice(index, 1);
    }

    if (stack.length === 0) {
      this.entries.delete(midi);
    }
  }

  /** the colour to draw: the most recent press, or undefined when at rest */
  public get(midi: number): string | undefined {
    const stack = this.entries.get(midi);
    return stack?.length ? stack[stack.length - 1]!.color : undefined;
  }

  public isPressed(midi: number): boolean {
    return (this.entries.get(midi)?.length ?? 0) > 0;
  }

  /** every key with at least one source holding it */
  public pressed(): number[] {
    return [...this.entries.keys()];
  }

  public get size(): number {
    return this.entries.size;
  }

  public clear(): void {
    this.entries.clear();
  }
}
