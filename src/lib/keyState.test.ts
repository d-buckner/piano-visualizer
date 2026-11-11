import { describe, it, expect, vi, beforeEach } from 'vitest';
import KeyState from './keyState';

describe('KeyState', () => {
  let keys: KeyState;

  beforeEach(() => {
    keys = new KeyState();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('press and release', () => {
    it('records a pressed key', () => {
      keys.press(60, '#ff0000');

      expect(keys.isPressed(60)).toBe(true);
      expect(keys.get(60)).toBe('#ff0000');
      expect(keys.size).toBe(1);
    });

    it('ignores notes outside the piano', () => {
      keys.press(20, '#ff0000');
      keys.press(109, '#ff0000');

      expect(keys.size).toBe(0);
      expect(console.warn).toHaveBeenCalled();
    });

    it('accepts the ends of the range', () => {
      keys.press(21, '#aaa');
      keys.press(108, '#bbb');

      expect(keys.get(21)).toBe('#aaa');
      expect(keys.get(108)).toBe('#bbb');
    });

    it('releasing an unpressed key does nothing', () => {
      keys.release(60);

      expect(keys.size).toBe(0);
    });
  });

  describe('stacking', () => {
    it('keeps the most recent colour while several sources hold a key', () => {
      keys.press(60, '#111', 'a');
      keys.press(60, '#222', 'b');

      expect(keys.get(60)).toBe('#222');
    });

    it('reveals the earlier colour when the newest source lets go', () => {
      keys.press(60, '#111', 'a');
      keys.press(60, '#222', 'b');
      keys.release(60, 'b');

      expect(keys.get(60)).toBe('#111');
      expect(keys.isPressed(60)).toBe(true);
    });

    it('clears the key when the last source lets go', () => {
      keys.press(60, '#111', 'a');
      keys.press(60, '#222', 'b');
      keys.release(60, 'a');
      keys.release(60, 'b');

      expect(keys.isPressed(60)).toBe(false);
      expect(keys.get(60)).toBeUndefined();
      expect(keys.size).toBe(0);
    });

    it('releases the newest press when no identifier is given', () => {
      keys.press(60, '#111');
      keys.press(60, '#222');
      keys.release(60);

      expect(keys.get(60)).toBe('#111');
    });

    it('ignores a release naming an identifier that is not held', () => {
      keys.press(60, '#111', 'a');
      keys.release(60, 'zzz');

      expect(keys.get(60)).toBe('#111');
      expect(keys.isPressed(60)).toBe(true);
    });

    it('releases an untracked press without an identifier', () => {
      keys.press(60, '#111');
      keys.press(60, '#222');
      keys.release(60);
      keys.release(60);

      expect(keys.isPressed(60)).toBe(false);
    });
  });

  describe('lookup', () => {
    it('returns undefined for a resting key', () => {
      expect(keys.get(48)).toBeUndefined();
      expect(keys.isPressed(48)).toBe(false);
    });

    it('clears everything', () => {
      keys.press(60, '#111');
      keys.press(64, '#222');
      keys.clear();

      expect(keys.size).toBe(0);
      expect(keys.isPressed(60)).toBe(false);
    });
  });
});
