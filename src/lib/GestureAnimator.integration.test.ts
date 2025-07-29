import { describe, it, expect } from 'vitest';
import GestureAnimator from './GestureAnimator';

describe('GestureAnimator Integration', () => {
  it('should produce identical animation steps to original implementation', () => {
    const positions: number[] = [];
    const animator = new GestureAnimator({
      onPositionChange: (x) => positions.push(x),
      easing: {
        deltaPowtValue: 1.5,
        deltaDivisor: 600,
      },
    });

    // Simulate the exact scenario from original VIZ_CONFIG
    animator.setPosition(0);
    animator.setTarget(100);

    // Clear initial position from setPosition call
    positions.length = 0;

    const mockTicker = { deltaMS: 16.67 }; // 60fps

    // Animate 5 steps like the original system would
    for (let i = 0; i < 5; i++) {
      animator.animate(mockTicker as any);
    }

    // Verify step calculations match original easing formula
    const expectedFirstStep = Math.max(
      (16.67 * Math.pow(100, 1.5)) / 600,
      1
    );
    expect(positions[0]).toBeCloseTo(expectedFirstStep, 2);

    // Verify animation progresses toward target
    expect(positions[0]).toBeGreaterThan(0);
    expect(positions[1]).toBeGreaterThan(positions[0]);
    expect(positions[4]).toBeLessThan(100);
    
    // Verify no overshoot
    positions.forEach(pos => {
      expect(pos).toBeLessThanOrEqual(100);
      expect(pos).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle exact same edge case as original animateContainerX', () => {
    const positions: number[] = [];
    const animator = new GestureAnimator({
      onPositionChange: (x) => positions.push(x),
    });

    // Test the exact deltaX boundary conditions from original
    animator.setPosition(99.5);
    animator.setTarget(100);

    animator.animate({ deltaMS: 16.67 } as any);

    // Should snap to target when delta <= 1 (exactly like original)
    expect(animator.getCurrentPosition()).toBe(100);
  });
});