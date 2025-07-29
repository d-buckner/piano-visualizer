import { describe, it, expect, beforeEach, vi } from 'vitest';
import GestureAnimator from './GestureAnimator';

describe('GestureAnimator', () => {
  let animator: GestureAnimator;
  let onPositionChange: ReturnType<typeof vi.fn>;
  let mockTicker: { deltaMS: number };

  beforeEach(() => {
    onPositionChange = vi.fn();
    animator = new GestureAnimator({
      onPositionChange,
    });
    mockTicker = { deltaMS: 16.67 }; // ~60fps
  });

  describe('position management', () => {
    it('should set initial position', () => {
      animator.setPosition(100);
      
      expect(animator.getCurrentPosition()).toBe(100);
      expect(onPositionChange).toHaveBeenCalledWith(100);
    });

    it('should set target position', () => {
      animator.setTarget(200);
      
      expect(animator.getTargetPosition()).toBe(200);
      expect(onPositionChange).not.toHaveBeenCalled();
    });

    it('should return current and target positions', () => {
      animator.setPosition(50);
      animator.setTarget(150);
      
      expect(animator.getCurrentPosition()).toBe(50);
      expect(animator.getTargetPosition()).toBe(150);
    });
  });

  describe('animation behavior', () => {
    it('should not animate when current equals target', () => {
      animator.setPosition(100);
      animator.setTarget(100);
      
      onPositionChange.mockClear();
      animator.animate(mockTicker as any);
      
      expect(onPositionChange).not.toHaveBeenCalled();
      expect(animator.getCurrentPosition()).toBe(100);
    });

    it('should snap to target when delta is 1 or less', () => {
      animator.setPosition(99.5);
      animator.setTarget(100);
      
      animator.animate(mockTicker as any);
      
      expect(animator.getCurrentPosition()).toBe(100);
      expect(onPositionChange).toHaveBeenCalledWith(100);
    });

    it('should animate toward positive target with easing', () => {
      animator.setPosition(0);
      animator.setTarget(100);
      
      animator.animate(mockTicker as any);
      
      const newPosition = animator.getCurrentPosition();
      expect(newPosition).toBeGreaterThan(0);
      expect(newPosition).toBeLessThan(100);
      expect(onPositionChange).toHaveBeenCalledWith(newPosition);
    });

    it('should animate toward negative target with easing', () => {
      animator.setPosition(100);
      animator.setTarget(0);
      
      animator.animate(mockTicker as any);
      
      const newPosition = animator.getCurrentPosition();
      expect(newPosition).toBeLessThan(100);
      expect(newPosition).toBeGreaterThan(0);
      expect(onPositionChange).toHaveBeenCalledWith(newPosition);
    });

    it('should use easing formula matching original implementation', () => {
      // Test the specific easing calculation
      animator.setPosition(0);
      animator.setTarget(600); // Large delta to test easing formula
      
      animator.animate(mockTicker as any);
      
      // Expected calculation: Math.max((16.67 * Math.pow(600, 1.5)) / 600, 1)
      // = Math.max((16.67 * 14696.94) / 600, 1) = Math.max(408.45, 1) = 408.45
      const expectedStep = Math.max(
        (16.67 * Math.pow(600, 1.5)) / 600,
        1
      );
      
      expect(animator.getCurrentPosition()).toBeCloseTo(expectedStep, 1);
    });

    it('should handle multiple animation steps toward target', () => {
      animator.setPosition(0);
      animator.setTarget(100);
      
      const positions: number[] = [];
      
      // Animate several steps
      for (let i = 0; i < 5; i++) {
        animator.animate(mockTicker as any);
        positions.push(animator.getCurrentPosition());
      }
      
      // Should continuously approach target
      expect(positions[0]).toBeGreaterThan(0);
      expect(positions[1]).toBeGreaterThan(positions[0]);
      expect(positions[2]).toBeGreaterThan(positions[1]);
      expect(positions[4]).toBeLessThan(100); // Shouldn't overshoot
    });
  });

  describe('custom easing configuration', () => {
    it('should accept custom easing parameters', () => {
      const customAnimator = new GestureAnimator({
        onPositionChange: vi.fn(),
        easing: {
          deltaPowtValue: 2.0,
          deltaDivisor: 300,
        },
      });
      
      customAnimator.setPosition(0);
      customAnimator.setTarget(100);
      customAnimator.animate(mockTicker as any);
      
      // Custom easing should produce different step size
      // Math.max((16.67 * Math.pow(100, 2.0)) / 300, 1) = Math.max(555.67, 1) = 555.67
      expect(customAnimator.getCurrentPosition()).toBeCloseTo(555.67, 1);
    });

    it('should use default easing when none provided', () => {
      // Default values should match original VIZ_CONFIG
      animator.setPosition(0);
      animator.setTarget(100);
      animator.animate(mockTicker as any);
      
      // Default: Math.max((16.67 * Math.pow(100, 1.5)) / 600, 1) = Math.max(27.78, 1) = 27.78
      expect(animator.getCurrentPosition()).toBeCloseTo(27.78, 1);
    });
  });

  describe('edge cases', () => {
    it('should handle zero delta time', () => {
      animator.setPosition(0);
      animator.setTarget(100);
      
      const zeroTicker = { deltaMS: 0 };
      animator.animate(zeroTicker as any);
      
      // Should still move at least 1 pixel due to Math.max(calculation, 1)
      expect(animator.getCurrentPosition()).toBe(1);
    });

    it('should handle very small deltas', () => {
      animator.setPosition(0);
      animator.setTarget(2);
      
      animator.animate(mockTicker as any);
      
      // Small delta should still move at least 1 pixel
      const position = animator.getCurrentPosition();
      expect(position).toBeGreaterThanOrEqual(1);
      expect(position).toBeLessThanOrEqual(2);
    });

    it('should handle negative positions', () => {
      animator.setPosition(-100);
      animator.setTarget(0);
      
      animator.animate(mockTicker as any);
      
      const newPosition = animator.getCurrentPosition();
      expect(newPosition).toBeGreaterThan(-100);
      expect(newPosition).toBeLessThan(0);
    });
  });
});