import { describe, it, expect, beforeEach, vi } from 'vitest';
import Cursor, { CursorType } from './Cursor';

describe('Cursor', () => {
  let mockElement: HTMLElement;

  beforeEach(() => {
    // Create a mock element with style property
    mockElement = {
      style: {
        cursor: '',
      },
    } as any;
    
    // Initialize cursor with mock element
    Cursor.init(mockElement);
  });

  describe('set', () => {
    it('should set cursor to pointer', () => {
      Cursor.set(CursorType.POINTER);
      
      expect(mockElement.style.cursor).toBe('pointer');
    });

    it('should set cursor to grabbing', () => {
      Cursor.set(CursorType.GRABBING);
      
      expect(mockElement.style.cursor).toBe('grabbing');
    });

    it('should update cursor when changed', () => {
      Cursor.set(CursorType.POINTER);
      expect(mockElement.style.cursor).toBe('pointer');
      
      Cursor.set(CursorType.GRABBING);
      expect(mockElement.style.cursor).toBe('grabbing');
    });

    it('should throw error if not initialized', () => {
      // Create a new cursor instance without initialization
      const uninitializedCursor = class extends Cursor {
        public static resetForTesting() {
          (Cursor as any).targetElement = null;
        }
      };
      
      uninitializedCursor.resetForTesting();
      
      expect(() => Cursor.set(CursorType.POINTER)).toThrow('Cannot set cursor before initialization');
      
      // Re-initialize for other tests
      Cursor.init(mockElement);
    });
  });

  describe('init', () => {
    it('should initialize with target element', () => {
      const element = document.createElement('div');
      Cursor.init(element);
      
      // Should not throw when setting cursor after init
      expect(() => Cursor.set(CursorType.POINTER)).not.toThrow();
    });
  });

  describe('CursorType enum', () => {
    it('should have correct values', () => {
      expect(CursorType.POINTER).toBe('pointer');
      expect(CursorType.GRABBING).toBe('grabbing');
      expect(CursorType.GRAB).toBe('grab');
      expect(CursorType.NS_RESIZE).toBe('ns-resize');
      expect(CursorType.DEFAULT).toBe('');
    });
  });
});