import { describe, it, expect, afterEach } from 'vitest';
import { isWebGL2Supported, resetWebGL2SupportCache, WebGL2UnavailableError } from './webgl.js';

describe('isWebGL2Supported', () => {
  afterEach(() => {
    resetWebGL2SupportCache();
  });

  it('reports false instead of throwing where no WebGL2 exists', () => {
    // happy-dom hands back null for webgl2 contexts
    expect(isWebGL2Supported()).toBe(false);
  });

  it('caches the answer', () => {
    const first = isWebGL2Supported();
    const original = document.createElement;
    document.createElement = () => {
      throw new Error('must not be called twice');
    };
    expect(isWebGL2Supported()).toBe(first);
    document.createElement = original;
  });

  it('is safe during server rendering', () => {
    const original = globalThis.document;
    // @ts-expect-error deliberately removing the global to emulate SSR
    delete globalThis.document;
    resetWebGL2SupportCache();

    expect(isWebGL2Supported()).toBe(false);

    globalThis.document = original;
  });
});

describe('WebGL2UnavailableError', () => {
  it('is catchable as its own type', () => {
    const error = new WebGL2UnavailableError();
    expect(error).toBeInstanceOf(WebGL2UnavailableError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('WebGL2UnavailableError');
  });
});
