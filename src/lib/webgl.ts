/**
 * WebGL2 capability probing.
 *
 * The GL renderer cannot degrade quietly - a missing context means a blank
 * canvas - so the check has to be something a host can run *before* building a
 * visualiser and branch on, rather than an exception from deep inside a
 * constructor.
 */

export class WebGL2UnavailableError extends Error {
  constructor(message = 'piano-visualizer: WebGL2 is not available in this browser') {
    super(message);
    this.name = 'WebGL2UnavailableError';
    // keeps `instanceof` working after the ES5-ish downlevel some bundlers do
    Object.setPrototypeOf(this, WebGL2UnavailableError.prototype);
  }
}

let cached: boolean | null = null;

/**
 * False on the server, so a server-rendered pass never touches a DOM API.
 * The answer is cached in the browser; a probe context is created and released
 * because browsers cap live contexts at roughly a dozen.
 */
export function isWebGL2Supported(): boolean {
  if (cached !== null) {
    return cached;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      cached = false;
      return false;
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cached = true;
    return true;
  } catch {
    cached = false;
    return false;
  }
}

/** test hook: forget the cached answer */
export function resetWebGL2SupportCache(): void {
  cached = null;
}
