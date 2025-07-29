import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import debounce from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delay function execution', () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 100);

    debouncedFn();
    
    expect(callback).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(100);
    
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should cancel previous call if called again within delay', () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 100);

    debouncedFn();
    vi.advanceTimersByTime(50);
    debouncedFn();
    vi.advanceTimersByTime(50);
    
    expect(callback).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(50);
    
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple rapid calls', () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 100);

    // Rapid calls
    debouncedFn();
    debouncedFn();
    debouncedFn();
    debouncedFn();
    debouncedFn();
    
    vi.advanceTimersByTime(100);
    
    // Should only be called once
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the callback', () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 100);

    debouncedFn('arg1', 'arg2', { key: 'value' });
    
    vi.advanceTimersByTime(100);
    
    expect(callback).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' });
  });

  it('should use the last set of arguments when called multiple times', () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 100);

    debouncedFn('first');
    vi.advanceTimersByTime(50);
    debouncedFn('second');
    vi.advanceTimersByTime(50);
    debouncedFn('third');
    
    vi.advanceTimersByTime(100);
    
    expect(callback).toHaveBeenCalledWith('third');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should allow separate executions after delay', () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 100);

    debouncedFn('first');
    vi.advanceTimersByTime(100);
    
    expect(callback).toHaveBeenCalledWith('first');
    
    debouncedFn('second');
    vi.advanceTimersByTime(100);
    
    expect(callback).toHaveBeenCalledWith('second');
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should handle zero delay', () => {
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 0);

    debouncedFn();
    
    vi.advanceTimersByTime(0);
    
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should clear timeout properly', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const callback = vi.fn();
    const debouncedFn = debounce(callback, 100);

    debouncedFn();
    debouncedFn(); // This should clear the previous timeout
    
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    
    vi.advanceTimersByTime(100);
  });

  it('should maintain separate state for different debounced functions', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const debouncedFn1 = debounce(callback1, 100);
    const debouncedFn2 = debounce(callback2, 150);

    debouncedFn1();
    debouncedFn2();
    
    vi.advanceTimersByTime(100);
    
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(50);
    
    expect(callback2).toHaveBeenCalledTimes(1);
  });
});