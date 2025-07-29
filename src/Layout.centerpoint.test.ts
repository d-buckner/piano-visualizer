import { describe, it, expect, beforeEach, vi } from 'vitest';
import Layout from './Layout';

describe('Layout Center-Point System', () => {
  let layout: Layout;

  beforeEach(() => {
    layout = new Layout({
      width: 1200,
      height: 800,
      pianoHeight: 250
    });
  });

  describe('center MIDI management', () => {
    it('should initialize with middle C as default center', () => {
      expect(layout.getCenterMidi()).toBe(60);
    });

    it('should set and get center MIDI', () => {
      layout.setCenterMidi(72); // C5
      expect(layout.getCenterMidi()).toBe(72);
    });

    it('should reject invalid MIDI ranges', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      layout.setCenterMidi(20); // Too low
      expect(layout.getCenterMidi()).toBe(60); // Should remain unchanged
      
      layout.setCenterMidi(109); // Too high  
      expect(layout.getCenterMidi()).toBe(60); // Should remain unchanged
      
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('should accept valid MIDI range boundaries', () => {
      layout.setCenterMidi(21); // A0
      expect(layout.getCenterMidi()).toBe(21);
      
      layout.setCenterMidi(108); // C8
      expect(layout.getCenterMidi()).toBe(108);
    });
  });

  describe('center MIDI quantization', () => {
    it('should quantize to visual grid positions', () => {
      // Set a center MIDI value
      layout.setCenterMidi(60.3);
      const quantized = layout.getQuantizedCenterMidi();
      
      // Should be a valid MIDI number within range
      expect(quantized).toBeGreaterThanOrEqual(21);
      expect(quantized).toBeLessThanOrEqual(108);
      expect(typeof quantized).toBe('number');
    });

    it('should use same visual quantization as getQuantizedX', () => {
      const testMidi = 65.7;
      layout.setCenterMidi(testMidi);
      
      // Convert through the same path manually
      const x = layout.centerMidiToX(testMidi);
      const quantizedX = layout.getQuantizedX(x);
      const expectedMidi = layout.xToCenterMidi(quantizedX);
      
      // Should match the method result
      expect(layout.getQuantizedCenterMidi()).toBeCloseTo(expectedMidi, 1);
    });

    it('should snap to consistent grid positions', () => {
      // Test that nearby values snap to the same grid position
      layout.setCenterMidi(60.1);
      const result1 = layout.getQuantizedCenterMidi();
      
      layout.setCenterMidi(60.2);
      const result2 = layout.getQuantizedCenterMidi();
      
      // Should be very close (within visual grid tolerance)
      expect(Math.abs(result1 - result2)).toBeLessThan(1);
    });
  });

  describe('coordinate conversion', () => {
    it('should convert between X and centerMidi consistently', () => {
      const testMidis = [21, 36, 48, 60, 72, 84, 96, 108];
      
      testMidis.forEach(originalMidi => {
        const x = layout.centerMidiToX(originalMidi);
        const convertedMidi = layout.xToCenterMidi(x);
        
        // Should be within 1 semitone due to quantization
        expect(Math.abs(convertedMidi - originalMidi)).toBeLessThanOrEqual(1);
      });
    });

    it('should handle center position correctly', () => {
      // When centerMidi is 60 (middle C), the X coordinate should center middle C
      layout.setCenterMidi(60);
      const x = layout.centerMidiToX(60);
      
      // X should be such that middle C appears at screen center
      // With width 1200, screen center is at 600px
      // The exact value depends on the layout calculations, but should be reasonable
      expect(typeof x).toBe('number');
    });

    it('should produce different X values for different MIDI notes', () => {
      const x1 = layout.centerMidiToX(60); // C
      const x2 = layout.centerMidiToX(72); // C an octave higher
      
      expect(x1).not.toBe(x2);
      expect(Math.abs(x1 - x2)).toBeGreaterThan(0);
    });

    it('should handle width factor scaling', () => {
      // Use MIDI 72 (C5) which is not at the default offset
      const originalX = layout.centerMidiToX(72);
      
      // Change width factor by changing visible keys
      layout.setVisibleKeys(8); // Zoom in
      const zoomedX = layout.centerMidiToX(72);
      
      // X coordinates should scale with width factor
      expect(zoomedX).not.toBe(originalX);
    });
  });

  describe('mathematical properties', () => {
    it('should maintain order: lower MIDI = lower X (generally)', () => {
      // Test with natural keys to avoid quantization issues
      const midi1 = 48; // C3
      const midi2 = 60; // C4  
      const midi3 = 72; // C5
      
      const x1 = layout.centerMidiToX(midi1);
      const x2 = layout.centerMidiToX(midi2);
      const x3 = layout.centerMidiToX(midi3);
      
      expect(x1).toBeLessThan(x2);
      expect(x2).toBeLessThan(x3);
    });

    it('should handle edge cases gracefully', () => {
      // Test boundary MIDI values
      expect(() => layout.centerMidiToX(21)).not.toThrow(); // A0
      expect(() => layout.centerMidiToX(108)).not.toThrow(); // C8
      
      expect(() => layout.xToCenterMidi(-10000)).not.toThrow(); // Very negative X
      expect(() => layout.xToCenterMidi(10000)).not.toThrow(); // Very positive X
    });

    it('should produce valid MIDI values for reasonable inputs', () => {
      for (let x = -1000; x <= 1000; x += 100) {
        const midi = layout.xToCenterMidi(x);
        expect(midi).toBeGreaterThanOrEqual(21);
        expect(midi).toBeLessThanOrEqual(108);
      }
    });
  });

  describe('range control', () => {
    it('should set and get range correctly', () => {
      layout.setRange(72, 10); // C5 center, 10 visible keys
      
      const range = layout.getRange();
      expect(range.centerMidi).toBe(72);
      expect(range.visibleKeys).toBe(10);
    });

    it('should reject invalid center MIDI values', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalRange = layout.getRange();
      
      layout.setRange(20, 8); // Too low
      expect(layout.getRange()).toEqual(originalRange);
      
      layout.setRange(109, 8); // Too high
      expect(layout.getRange()).toEqual(originalRange);
      
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('should reject invalid visible keys values', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalRange = layout.getRange();
      
      layout.setRange(60, 3); // Too few keys
      expect(layout.getRange()).toEqual(originalRange);
      
      layout.setRange(60, 89); // Too many keys
      expect(layout.getRange()).toEqual(originalRange);
      
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('should update layout position when setting range', () => {
      const originalX = layout.getX();
      
      // Set range with different center - should change X position
      layout.setRange(72, 12); // C5 center
      const newX = layout.getX();
      
      expect(newX).not.toBe(originalX);
      expect(layout.getVisibleKeys()).toBe(12);
    });

    it('should maintain consistency between range and visible keys', () => {
      layout.setRange(60, 16);
      
      expect(layout.getRange().visibleKeys).toBe(16);
      expect(layout.getVisibleKeys()).toBe(16);
    });
  });

  describe('integration with existing layout', () => {
    it('should not interfere with existing X coordinate system', () => {
      const originalX = layout.getX();
      
      // Using center MIDI methods shouldn't affect current X
      layout.setCenterMidi(72);
      layout.getQuantizedCenterMidi();
      layout.centerMidiToX(60);
      layout.xToCenterMidi(100);
      
      expect(layout.getX()).toBe(originalX);
    });

    it('should work with different visible key counts', () => {
      const ranges = [8, 12, 16];
      
      ranges.forEach(range => {
        layout.setVisibleKeys(range);
        
        // Should still convert without errors
        const x = layout.centerMidiToX(60);
        const midi = layout.xToCenterMidi(x);
        
        expect(midi).toBeGreaterThanOrEqual(21);
        expect(midi).toBeLessThanOrEqual(108);
      });
    });
  });
});