import { describe, it, expect } from 'vitest';
import Pitch from './Pitch';

describe('Pitch', () => {
  describe('constructor', () => {
    it('should correctly calculate chroma from midi number', () => {
      expect(new Pitch(60).chroma).toBe(0); // C
      expect(new Pitch(61).chroma).toBe(1); // C#
      expect(new Pitch(62).chroma).toBe(2); // D
      expect(new Pitch(71).chroma).toBe(11); // B
    });

    it('should correctly calculate octave from midi number', () => {
      expect(new Pitch(21).octave).toBe(1); // A0
      expect(new Pitch(60).octave).toBe(5); // C4 (middle C)
      expect(new Pitch(108).octave).toBe(9); // C8
    });

    it('should correctly calculate key offset from A0', () => {
      expect(new Pitch(21).key).toBe(0); // A0 = key 0
      expect(new Pitch(60).key).toBe(39); // C4 = key 39
      expect(new Pitch(108).key).toBe(87); // C8 = key 87
    });

    it('should store the original midi number', () => {
      const pitch = new Pitch(72);
      expect(pitch.midi).toBe(72);
    });
  });

  describe('isNatural', () => {
    it('should identify natural notes correctly', () => {
      expect(new Pitch(60).isNatural).toBe(true); // C
      expect(new Pitch(62).isNatural).toBe(true); // D
      expect(new Pitch(64).isNatural).toBe(true); // E
      expect(new Pitch(65).isNatural).toBe(true); // F
      expect(new Pitch(67).isNatural).toBe(true); // G
      expect(new Pitch(69).isNatural).toBe(true); // A
      expect(new Pitch(71).isNatural).toBe(true); // B
    });

    it('should identify accidental notes correctly', () => {
      expect(new Pitch(61).isNatural).toBe(false); // C#
      expect(new Pitch(63).isNatural).toBe(false); // D#
      expect(new Pitch(66).isNatural).toBe(false); // F#
      expect(new Pitch(68).isNatural).toBe(false); // G#
      expect(new Pitch(70).isNatural).toBe(false); // A#
    });
  });
});