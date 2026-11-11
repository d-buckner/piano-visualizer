# Piano Visualizer

Composable piano experiences for the web: a keyboard, a scrolling piano roll, or
the full visualizer — plus optional sound. Framework-agnostic, drawn with
WebGL2, and no renderer dependency.

Every part is a module you can use alone. Import only what you render, and your
bundle only pays for what you imported.

## Installation

```bash
pnpm add piano-visualizer
```

There is no renderer to install. The whole scene is one WebGL2 instanced quad
draw call issued by a renderer that ships inside the package.

Optional, for sound:

```bash
pnpm add d-piano tone
```

## Requirements

WebGL2. There is no Canvas2D fallback — a keyboard that silently renders nothing
is worse than one that tells you. Check before you construct:

```typescript
import { isWebGL2Supported } from 'piano-visualizer';

if (isWebGL2Supported()) {
  new Visualization({ container });
} else {
  renderSomethingStatic();
}
```

Constructing without WebGL2 throws `WebGL2UnavailableError`. A lost context
(GPU reset, tab backgrounded on some drivers, context-limit pressure) is
recovered automatically; `viz.contextLost` is `true` while it cannot draw.

## Usage

### The whole thing

```typescript
import Visualization from 'piano-visualizer';

const viz = new Visualization({
  container: document.getElementById('piano-container'),
  backgroundColor: 'black',
  onKeyDown: (midi) => '#ff0000', // optional: return a color for this note
  onKeyUp: (midi) => {},
});

viz.startNote(60, '#00ff00'); // middle C, green
viz.endNote(60);
viz.destroy();
```

### Just the keyboard

Give it an element and it runs itself — its own canvas, resize handling, raf
loop and pointer input. No piano roll, no falling notes, no particles are
constructed.

```typescript
import Piano from 'piano-visualizer/keyboard';

const keyboard = new Piano({
  container: document.querySelector('.input-strip'),
  range: { centerMidi: 60, visibleKeys: 14 },
  onKeyDown: (midi) => keyboard.keyDown(midi, '#4d91ff'),
  onKeyUp: (midi) => keyboard.keyUp(midi),
});
```

This is the shape a compact input strip under a score view needs. See
`keyboard.html` in the demo (`pnpm dev`, then `/keyboard.html`).

### Just the piano roll

```typescript
import PianoRoll from 'piano-visualizer/piano-roll';

const roll = new PianoRoll({
  container: document.querySelector('.roll'),
  range: { centerMidi: 60, visibleKeys: 24 },
});

roll.startNote(64, '#62d982', 'player-1');
roll.endNote(64, 'player-1');
```

The roll never owns note input, room state, or audio scheduling. You project
note state in with `startNote` / `endNote`. `pianoHeight` reserves the strip a
keyboard you draw yourself occupies, so blocks stop at its top instead of
sliding underneath.

### Sound (optional)

`d-piano` is an optional peer dependency and lives behind its own entry, so it
never enters the bundle of an app that only renders.

```typescript
import Visualization from 'piano-visualizer';
import PianoAudio from 'piano-visualizer/audio';

const audio = new PianoAudio(); // loads d-piano lazily

const viz = new Visualization({
  container,
  ...audio.handlers(),
});
```

Bring your own instrument to keep d-piano out of the graph entirely:

```typescript
import PianoAudio from 'piano-visualizer/audio';
import { Piano } from 'd-piano';

const audio = new PianoAudio({ instrument: new Piano({ velocities: 8 }) });
audio.keyDown(60, 0.9);
audio.pedalDown();
```

## Entry points

| Import                        | What you get                                        |
| ----------------------------- | --------------------------------------------------- |
| `piano-visualizer`            | everything, named; default is `Visualization`       |
| `piano-visualizer/keyboard`   | keyboard rendering + pointer input                  |
| `piano-visualizer/piano-roll` | scrolling note blocks                               |
| `piano-visualizer/core`       | `Layout`, `Pitch`, `KeyState`, colour helpers       |
| `piano-visualizer/audio`      | `PianoAudio`, d-piano loader                        |

The package ships one file per module with `"sideEffects": false`, so named
imports from the root barrel shake as well as subpath imports. This is asserted
on every build by `pnpm run check:shaking`:

| Import                     | Package code in the bundle |
| -------------------------- | -------------------------- |
| `piano-visualizer/keyboard`| 43.4 kb                    |
| `piano-visualizer/piano-roll` | 38.3 kb                 |
| `piano-visualizer/audio`   | 4.0 kb                     |
| `piano-visualizer/core`    | 9.6 kb                     |
| full composition           | 75.8 kb                    |

Those are minified, uncompressed, and count only this package's own modules —
there is no renderer library added on top.

## API

### Shared by `Piano`, `PianoRoll`, `Visualization`

```typescript
startNote(midi: number, color?: string, identifier?: string)
endNote(midi: number, identifier?: string)
setRange(centerMidi: number, visibleKeys: number)
getRange(): { centerMidi: number; visibleKeys: number }
setCenterMidi(midi: number) / getCenterMidi(): number
setVisibleKeys(n: number) / getVisibleKeys(): number
setWidthFactor(n: number) / getWidthFactor(): number
destroy()
```

`identifier` lets several sources (local user, remote peers, a score player)
hold the same note without fighting over it. Each key keeps a stack of presses:
releasing one reveals the colour of whatever is still holding the key rather
than clearing it.

`forceRedraw()` still exists and does nothing. It was needed by the previous
renderer, which cached drawn graphics; this one rebuilds its instance buffer
from state every frame.

### `Piano` config

```typescript
{
  container: HTMLElement;
  layout?: Layout;                              // share geometry with a host
  range?: { centerMidi: number; visibleKeys: number };
  backgroundColor?: string;
  onKeyDown?: (midi: number) => void;
  onKeyUp?: (midi: number) => void;
}
```

Plus `keyDown(midi, color?, identifier?)`, `keyUp(midi, identifier?)`,
`setRange()`, `resize()`, `render()`, `destroy()`.

### `PianoRoll` config

```typescript
{
  container: HTMLElement;
  pianoHeight?: number;      // space reserved for a keyboard, default 0
  range?: { centerMidi: number; visibleKeys: number };
  backgroundColor?: string;
}
```

Plus `startNote()`, `endNote()`, `getBlockPositions()`, `setRange()`,
`getRange()`, `destroy()`.

### `Visualization` config

```typescript
{
  container: HTMLElement;
  backgroundColor?: string;
  onKeyDown?: (midi: number) => string | undefined;
  onKeyUp?: (midi: number) => void;
}
```

Plus `getBlockPositions()`, `heldNotes`, `contextLost`, and `destroy()`.

### `PianoAudio` config

```typescript
{
  instrument?: Instrument;                  // any d-piano shaped object
  piano?: { velocities?: number; release?: boolean; pedal?: boolean };
  createInstrument?: () => Instrument | Promise<Instrument>;
  autoLoad?: boolean;                       // default true
  velocity?: number;                        // default 0.8
  getVelocity?: (midi: number) => number;
  onReady?: () => void;
}
```

Notes played before samples finish loading are held and replayed on ready; notes
released before they ever sounded stay silent.

## Renderer

The scene — key bodies and shadows, note blocks with a three-stop gradient and a
glow stack, background particles, backdrop, fade overlay — is entirely axis
aligned rounded rectangles. So it is one instanced draw call and the "scene
graph" is a `Float32Array`: each instance is 25 floats written into a shared
buffer, and a frame is one `drawArraysInstanced`.

There is no scene graph to diff, no texture atlas, no per-node allocation, and
nothing to pool. That is where the size and memory numbers come from.

Measured on a real GPU (Chromium with ANGLE Metal on an Apple M4 Pro, 1000×700,
3s sample, driven from an identical note schedule), against the PixiJS renderer
this replaced:

| Scene | Bundle min / gz | fps | frame avg / p99 | JS heap |
| --- | --- | --- | --- | --- |
| keyboard, pixi | 491.7 kb / 142.2 kb | 119.7 | 8.30 / 11.20 ms | 9.9 mb |
| keyboard, WebGL2 | 16.5 kb / 6.4 kb | 119.9 | 8.30 / 10.20 ms | 2.7 mb |
| full scene, pixi | 513.0 kb / 147.9 kb | 119.7 | 8.30 / 10.70 ms | 25.1 mb |
| full scene, WebGL2 | 30.5 kb / 10.7 kb | 119.8 | 8.30 / 10.20 ms | 3.7 mb |

Both sat at vsync (a 120 Hz display) with indistinguishable frame
distributions. **There is no frame-rate win.** The win is -93% gzipped and -85%
JS heap for the full scene, which is what matters on a phone connected to a
keyboard over Bluetooth.

One measurement caveat, recorded so nobody repeats it: the headless shell
rasterises through SwiftShader, and under software rasterisation the pixi scene
dropped to ~35 fps while the quad renderer held vsync. That was a measurement of
the CPU pretending to be a GPU. Any benchmark here needs a real GPU.

## Development

```bash
pnpm install
pnpm dev               # demo server: / and /keyboard.html
pnpm test              # unit tests (watch)
pnpm run test:run      # unit tests, once
pnpm run typecheck
pnpm run test:acceptance  # Playwright; needs `pnpm exec playwright install chromium`
pnpm run build         # library → dist/
pnpm run build:demo    # demo site → demo-dist/
pnpm run check:shaking # asserts the tree-shaking guarantees against dist/
```

The library is emitted by `tsc` as one module per file — a pre-rolled bundle
cannot be tree shaken by a consumer's bundler, and composability is the point.

Unit tests run in happy-dom, which has no WebGL context, so they cover the parts
that do not need one: geometry, hit testing, colour, note and key state,
particles, gestures. Everything that actually touches the GPU is covered by the
Playwright suite, which drives real pages with real touch events and a real
context loss.
