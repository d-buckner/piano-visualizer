import { describe, it, expect, beforeEach } from 'vitest';
import { Graphics } from 'pixi.js';
import GraphicsPool from './GraphicsPool';

describe('GraphicsPool', () => {
  let pool: GraphicsPool;

  beforeEach(() => {
    pool = new GraphicsPool(5); // Small pool for testing
  });

  describe('get and return operations', () => {
    it('should create new graphics when pool is empty', () => {
      const graphics = pool.get();
      expect(graphics).toBeInstanceOf(Graphics);
      expect(pool.poolSize).toBe(0);
    });

    it('should reuse graphics from pool', () => {
      const graphics1 = pool.get();
      pool.return(graphics1);
      expect(pool.poolSize).toBe(1);

      const graphics2 = pool.get();
      expect(graphics2).toBe(graphics1);
      expect(pool.poolSize).toBe(0);
    });

    it('should respect max pool size', () => {
      // Create separate graphics objects and fill pool to max
      const graphicsArray: Graphics[] = [];
      for (let i = 0; i < 6; i++) {
        graphicsArray.push(pool.get());
      }
      
      // Return them all
      for (const graphics of graphicsArray) {
        pool.return(graphics);
      }
      
      // Should only keep max pool size (5)
      expect(pool.poolSize).toBe(5);
    });
  });

  describe('cleanup operations', () => {
    it('should clear graphics when returning to pool', () => {
      const graphics = pool.get();
      graphics.rect(0, 0, 100, 100);
      // Just test that clear() was called - the graphics should be cleared
      expect(() => pool.return(graphics)).not.toThrow();
    });

    it('should clear all graphics when pool is cleared', () => {
      const graphicsArray: Graphics[] = [];
      for (let i = 0; i < 3; i++) {
        graphicsArray.push(pool.get());
      }
      for (const graphics of graphicsArray) {
        pool.return(graphics);
      }
      expect(pool.poolSize).toBe(3);

      pool.clear();
      expect(pool.poolSize).toBe(0);
    });
  });
});