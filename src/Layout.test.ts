import { describe, it, expect, beforeEach } from 'vitest';
import Layout from './Layout';

describe('Layout', () => {
  let layout: Layout;

  beforeEach(() => {
    layout = new Layout({
      width: 1200,
      height: 800,
      pianoHeight: 250
    });
  });

  describe('constructor', () => {
    it('should initialize with correct dimensions', () => {
      expect(layout.getHeight()).toBe(800);
      expect(layout.getPianoHeight()).toBe(250);
    });

    it('should calculate piano Y position correctly', () => {
      expect(layout.getPianoY()).toBe(550); // 800 - 250
    });

    it('should set piano roll height equal to piano Y', () => {
      expect(layout.getPianoRollHeight()).toBe(layout.getPianoY());
    });
  });

  describe('width management', () => {
    it('should update width and adjust diatonic range', () => {
      layout.setWidth(600);
      // Should adjust to smaller key range for narrow width
      expect(layout.getDiatonicRange()).toBeLessThan(16);
    });

    it('should use larger ranges for wider screens', () => {
      layout.setWidth(2000);
      expect(layout.getDiatonicRange()).toBe(16);
    });
  });

  describe('x position clamping', () => {
    it('should clamp x position to valid range', () => {
      const minX = layout.getClampedX(-10000);
      const maxX = layout.getClampedX(10000);
      
      expect(minX).toBeGreaterThan(-2000); // rough bounds check
      expect(maxX).toBeLessThan(5000);
    });

    it('should not clamp values within range', () => {
      const validX = 100;
      expect(layout.getClampedX(validX)).toBe(validX);
    });
  });

  describe('key element positioning', () => {
    it('should return consistent positions for the same midi note', () => {
      const element1 = layout.getKeyElement(60); // middle C
      const element2 = layout.getKeyElement(60);
      
      expect(element1.x).toBe(element2.x);
      expect(element1.width).toBe(element2.width);
      expect(element1.height).toBe(element2.height);
    });

    it('should give different widths for natural vs accidental keys', () => {
      const naturalKey = layout.getKeyElement(60); // C (natural)
      const accidentalKey = layout.getKeyElement(61); // C# (accidental)
      
      expect(naturalKey.width).toBeGreaterThan(accidentalKey.width);
      expect(naturalKey.height).toBeGreaterThan(accidentalKey.height);
    });
  });

  describe('section detection', () => {
    it('should identify piano roll section correctly', () => {
      const pianoY = layout.getPianoY();
      expect(layout.getSection(pianoY - 100)).toBe('PIANO_ROLL');
    });

    it('should identify piano section correctly', () => {
      const pianoY = layout.getPianoY();
      expect(layout.getSection(pianoY + 100)).toBe('PIANO');
    });
  });

  describe('x quantization', () => {
    it('should quantize x positions to key boundaries', () => {
      const quantized = layout.getQuantizedX(157);
      expect(quantized).toBe(150);
    });
  });
});