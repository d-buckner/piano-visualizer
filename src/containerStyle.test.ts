import { describe, it, expect } from 'vitest';
import containerStyle from './containerStyle';

describe('containerStyle', () => {
  it('should export a string containing CSS styles', () => {
    expect(typeof containerStyle).toBe('string');
    expect(containerStyle.length).toBeGreaterThan(0);
  });

  it('should include overflow hidden', () => {
    expect(containerStyle).toContain('overflow: hidden');
  });

  it('should include touch and scroll behavior styles', () => {
    expect(containerStyle).toContain('overscroll-behavior-x: none');
    expect(containerStyle).toContain('touch-action: none');
  });

  it('should include user select prevention styles', () => {
    expect(containerStyle).toContain('user-select: none');
    expect(containerStyle).toContain('-webkit-user-select: none');
  });

  it('should include webkit specific styles', () => {
    expect(containerStyle).toContain('-webkit-touch-callout: none');
    expect(containerStyle).toContain('-webkit-text-size-adjust: none');
  });

  it('should include positioning and size styles', () => {
    expect(containerStyle).toContain('position: absolute');
    expect(containerStyle).toContain('width: 100%');
    expect(containerStyle).toContain('height: 100%');
  });

  it('should be formatted as a CSS rule body', () => {
    // Should not contain selector, just properties
    expect(containerStyle).not.toContain('{');
    expect(containerStyle).not.toContain('}');
    expect(containerStyle).not.toContain('#');
    expect(containerStyle).not.toContain('.');
  });

  it('should have proper CSS syntax', () => {
    const rules = containerStyle
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('`'));
    
    rules.forEach(rule => {
      if (rule) {
        expect(rule).toMatch(/^[\w-]+:\s*[\w%-]+;$/);
      }
    });
  });
});