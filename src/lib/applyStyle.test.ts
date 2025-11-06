import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import applyStyle from './applyStyle';

// Mock containerStyle
vi.mock('../containerStyle', () => ({
  default: 'mocked-container-styles'
}));

describe('applyStyle', () => {
  let appendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    
    // Mock document.head.append
    appendSpy = vi.spyOn(document.head, 'append').mockImplementation(() => {});
    
    // Mock crypto.getRandomValues
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint32Array) {
        array[0] = 123456789;
      }
      return array;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clear any styles that might have been added
    document.head.innerHTML = '';
  });

  it('should create and append a style element', () => {
    applyStyle();
    
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith(expect.any(HTMLStyleElement));
  });

  it('should return an id with the correct prefix', () => {
    const id = applyStyle();
    
    expect(id).toMatch(/^pviz_/);
  });

  it('should generate unique ids', () => {
    // Mock different random values
    let callCount = 0;
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint32Array) {
        array[0] = 123456789 + callCount++;
      }
      return array;
    });

    const id1 = applyStyle();
    const id2 = applyStyle();
    
    expect(id1).not.toBe(id2);
  });

  it('should set correct style content', () => {
    const id = applyStyle();
    
    const styleElement = appendSpy.mock.calls[0][0] as HTMLStyleElement;
    expect(styleElement.textContent).toBe(`#${id} {mocked-container-styles}`);
  });

  it('should convert random number to base36', () => {
    const id = applyStyle();
    
    // 123456789 in base36 is '21i3v9'
    expect(id).toBe('pviz_21i3v9');
  });

  it('should handle multiple calls', () => {
    applyStyle();
    applyStyle();
    applyStyle();
    
    expect(appendSpy).toHaveBeenCalledTimes(3);
  });

  it('should create valid CSS selector ids', () => {
    const id = applyStyle();
    
    // ID should be valid for use in CSS selectors
    expect(id).toMatch(/^pviz_[a-z0-9]+$/);
  });
});