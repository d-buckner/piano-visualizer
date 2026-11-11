/**
 * prototype renderer: a purpose-built WebGL2 renderer for exactly what a piano
 * visualizer draws.
 *
 * every layer of this scene — key bodies, key shadows, note blocks, glow,
 * trails, particles, the fade overlay — is an axis-aligned rounded rectangle
 * with a vertical gradient, a hairline stroke, and an alpha. so the entire
 * scene is one instanced quad draw call, and the "scene graph" is a Float32Array.
 *
 * no pixi, no three. this file plus color.ts is the whole renderer.
 */
import { type RGBA, toFloats } from './color';
import { WebGL2UnavailableError } from './webgl';

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** corner radius in css px, clamped to half the short side in the shader */
  radius?: number;
  color: string | RGBA;
  /** bottom colour of a top-to-bottom gradient; omit for a flat fill */
  gradient?: string | RGBA;
  /** optional middle stop of a three-stop gradient */
  gradientMid?: string | RGBA;
  /** where the middle stop sits, 0 (top) to 1 (bottom) */
  gradientMidAt?: number;
  /** hairline stroke width in css px */
  stroke?: number;
  strokeColor?: string | RGBA;
  alpha?: number;
};

const FLOATS = 25; // rect(4) params(4) color(4) gradient(4) stroke(4) mid(4) midAt(1)
const STRIDE = FLOATS * 4;

const VERTEX_SRC = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aRect;
layout(location = 2) in vec4 aParams;
layout(location = 3) in vec4 aColor;
layout(location = 4) in vec4 aGradient;
layout(location = 5) in vec4 aStroke;
layout(location = 6) in vec4 aMid;
layout(location = 7) in float aMidAt;

uniform vec2 uResolution;

out vec2 vLocal;
out vec2 vHalf;
out vec4 vParams;
out vec4 vColor;
out vec4 vGradient;
out vec4 vStroke;
out vec4 vMid;
out float vMidAt;

void main() {
  vec2 origin = aRect.xy;
  vec2 size = max(aRect.zw, vec2(0.0));
  vec2 px = origin + size * aCorner;

  vLocal = px - (origin + size * 0.5);
  vHalf = size * 0.5;
  vParams = aParams;
  vColor = aColor;
  vGradient = aGradient;
  vStroke = aStroke;
  vMid = aMid;
  vMidAt = aMidAt;

  vec2 clip = (px / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FRAGMENT_SRC = `#version 300 es
precision mediump float;

in vec2 vLocal;
in vec2 vHalf;
in vec4 vParams;      // radius, strokeWidth, gradientFlag, alpha
in vec4 vColor;
in vec4 vGradient;
in vec4 vStroke;
in vec4 vMid;
in float vMidAt;

out vec4 outColor;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  float radius = min(vParams.x, min(vHalf.x, vHalf.y));
  float d = sdRoundBox(vLocal, vHalf, radius);

  // one pixel of analytic antialiasing on the edge
  float coverage = 1.0 - smoothstep(-1.0, 0.0, d);
  if (coverage <= 0.003) {
    discard;
  }

  float t = clamp(0.5 + vLocal.y / max(vHalf.y * 2.0, 1e-5), 0.0, 1.0);
  vec4 color = vColor;

  // params.z: 0 = flat, 1 = two stops, 2 = three stops (mid carries its position)
  if (vParams.z > 0.5) {
    if (vParams.z > 1.5) {
      float midAt = clamp(vMidAt, 0.001, 0.999);
      if (t < midAt) {
        color = mix(vColor, vMid, t / midAt);
      } else {
        color = mix(vMid, vGradient, (t - midAt) / (1.0 - midAt));
      }
    } else {
      color = mix(vColor, vGradient, t);
    }
  }

  float width = vParams.y;
  if (width > 0.0) {
    float ring = smoothstep(-width - 0.7, -width + 0.7, d) * (1.0 - smoothstep(-0.7, 0.0, d));
    color = mix(color, vStroke, ring);
  }

  outColor = vec4(color.rgb, color.a * vParams.w * coverage);
}`;

/** corners of a unit quad, drawn as a triangle strip */
const CORNERS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

export type QuadRendererOptions = {
  initialCapacity?: number;
  /** the canvas went blank; the host may want to show something */
  onContextLost?: () => void;
  /** GL objects were rebuilt and drawing has resumed */
  onContextRestored?: () => void;
};

export default class QuadRenderer {
  public readonly gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private options: QuadRendererOptions;
  // assigned by setup(), which the constructor calls and a context restore
  // calls again
  private program!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private instanceBuffer!: WebGLBuffer;
  private cornerBuffer!: WebGLBuffer;
  private data: Float32Array;
  private capacity: number;
  private count = 0;
  private resolution: [number, number] = [1, 1];
  private cssSize: [number, number] = [1, 1];
  private uResolution!: WebGLUniformLocation | null;
  private lost = false;

  constructor(canvas: HTMLCanvasElement, options: QuadRendererOptions = {}) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: 'low-power',
    });
    if (!gl) {
      throw new WebGL2UnavailableError();
    }

    this.canvas = canvas;
    this.gl = gl;
    this.options = options;
    this.capacity = options.initialCapacity ?? 512;
    this.data = new Float32Array(FLOATS * this.capacity);

    this.setup();

    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
  }

  /**
   * (re)create every GL object. A context restore invalidates programs,
   * buffers and VAOs wholesale, so this is the same work the constructor does -
   * without it the canvas stays blank until the page reloads.
   */
  private setup(): void {
    const gl = this.gl;

    this.program = this.createProgram(VERTEX_SRC, FRAGMENT_SRC);
    this.uResolution = gl.getUniformLocation(this.program, 'uResolution');

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    this.cornerBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, CORNERS, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.instanceBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);

    // attribute order must match the instance layout below: aRect, aParams,
    // aColor, aGradient, aStroke, aMid, aMidAt
    for (let index = 0; index < 6; index++) {
      const location = 1 + index;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 4, gl.FLOAT, false, STRIDE, index * 16);
      gl.vertexAttribDivisor(location, 1);
    }

    gl.enableVertexAttribArray(7);
    gl.vertexAttribPointer(7, 1, gl.FLOAT, false, STRIDE, 96);
    gl.vertexAttribDivisor(7, 1);

    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    // straight alpha for colour, but the alpha channel itself must accumulate as
    // srcA + dstA*(1-srcA); using SRC_ALPHA there too squares the source alpha
    // and lets the page background bleed through the canvas
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    this.count = 0;
  }

  /** instances queued for the current frame */
  public get instances(): number {
    return this.count;
  }

  public get contextLost(): boolean {
    return this.lost;
  }

  public resize(cssWidth: number, cssHeight: number): void {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.cssSize = [cssWidth, cssHeight];
    this.resolution = [cssWidth, cssHeight];
    if (!this.lost) {
      this.gl.viewport(0, 0, width, height);
    }
  }

  /** start a frame. everything drawn until flush() is one draw call. */
  public begin(background?: string): void {
    const { gl } = this;

    this.count = 0;
    if (this.lost) {
      return;
    }
    if (background) {
      const [r, g, b, a] = toFloats(background);
      gl.clearColor(r, g, b, a);
    } else {
      gl.clearColor(0, 0, 0, 0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  public rect(rect: Rect): void {
    this.push(
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      rect.radius ?? 0,
      rect.stroke ?? 0,
      rect.alpha ?? 1,
      asFloats(rect.color),
      rect.gradient ? asFloats(rect.gradient) : null,
      rect.strokeColor ? asFloats(rect.strokeColor) : BLACK,
      rect.gradientMid ? asFloats(rect.gradientMid) : null,
      rect.gradientMidAt ?? 0.5,
    );
  }

  /**
   * the primitive. `rect()` allocates and parses strings; hot loops that already
   * hold floats - 120 particles a frame, hundreds of note blocks - write
   * straight into the instance buffer through this.
   *
   * `gradient` being non-null selects a two-stop fill; passing `mid` as well
   * selects three stops, with mid.w carrying its position along the gradient.
   */
  public push(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    strokeWidth: number,
    alpha: number,
    color: RGBA,
    gradient: RGBA | null,
    strokeColor: RGBA,
    mid: RGBA | null = null,
    midAt = 0.5,
  ): void {
    const { gl } = this;

    if (this.lost || w <= 0 || h <= 0 || alpha <= 0) {
      return;
    }

    if (this.count === this.capacity) {
      this.capacity *= 2;
      this.data = new Float32Array(FLOATS * this.capacity);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    }

    const offset = this.count * FLOATS;
    const data = this.data;

    data[offset] = x;
    data[offset + 1] = y;
    data[offset + 2] = w;
    data[offset + 3] = h;

    data[offset + 4] = radius;
    data[offset + 5] = strokeWidth;
    data[offset + 6] = gradient ? (mid ? 2 : 1) : 0;
    data[offset + 7] = alpha;

    writeColor(data, offset + 8, color);
    writeColor(data, offset + 12, gradient ?? color);
    writeColor(data, offset + 16, strokeColor);
    writeColor(data, offset + 20, mid ?? color);
    data[offset + 24] = midAt;

    this.count += 1;
  }

  public circle(
    centerX: number,
    centerY: number,
    radius: number,
    color: string | RGBA,
    alpha = 1,
  ): void {
    this.push(
      centerX - radius,
      centerY - radius,
      radius * 2,
      radius * 2,
      radius,
      0,
      alpha,
      asFloats(color),
      null,
      BLACK,
      null,
      0.5,
    );
  }

  public flush(): void {
    const { gl } = this;

    if (this.lost || this.count === 0) {
      return;
    }

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.uResolution, this.resolution[0], this.resolution[1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * FLOATS);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
  }

  public destroy(): void {
    this.lost = true;
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl.deleteProgram(this.program);
    this.gl.deleteBuffer(this.instanceBuffer);
    this.gl.deleteBuffer(this.cornerBuffer);
    this.gl.deleteVertexArray(this.vao);
  }

  private onLost = (event: Event) => {
    // preventDefault is what makes the browser attempt a restore at all
    event.preventDefault();
    this.lost = true;
    this.options.onContextLost?.();
  };

  private onRestored = () => {
    try {
      this.data = new Float32Array(FLOATS * this.capacity);
      this.setup();
      this.lost = false;
      this.resize(this.cssSize[0], this.cssSize[1]);
      this.options.onContextRestored?.();
    } catch {
      this.lost = true;
    }
  };

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const { gl } = this;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`QuadRenderer: ${gl.getShaderInfoLog(shader)}`);
      }
      return shader;
    };

    const program = gl.createProgram()!;
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`QuadRenderer: ${gl.getProgramInfoLog(program)}`);
    }

    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return program;
  }
}

function writeColor(target: Float32Array, offset: number, color: RGBA): void {
  target[offset] = color[0];
  target[offset + 1] = color[1];
  target[offset + 2] = color[2];
  target[offset + 3] = color[3];
}

const BLACK: RGBA = [0, 0, 0, 0];

function asFloats(color: string | RGBA): RGBA {
  return typeof color === 'string' ? toFloats(color) : color;
}
