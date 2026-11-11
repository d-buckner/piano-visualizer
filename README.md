# Piano Visualizer

Composable piano experiences for the web: a keyboard, a scrolling piano roll, or
the full visualizer — plus optional sound. Built on PixiJS, framework-agnostic.

Every part is a module you can use alone. Import only what you render, and your
bundle only pays for what you imported.

## Installation

```bash
npm install piano-visualizer pixi.js
```

`pixi.js` is a peer dependency, so it is bundled once and shared with the rest
of your app.

Optional, for sound:

```bash
npm install d-piano tone
```

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

Give it an element and it runs itself — its own application, resize handling,
and ticker. No piano roll, no falling notes, no particles are constructed.

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
`keyboard.html` in the demo (`npm run dev`, then `/keyboard.html`).

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
note state in with `startNote` / `endNote`.

### Composing them yourself

Both modules also accept a PixiJS `Container` instead of an element, so you can
mount them into a scene graph you already render:

```typescript
import { Layout } from 'piano-visualizer/core';
import Piano from 'piano-visualizer/keyboard';
import PianoRoll from 'piano-visualizer/piano-roll';

const layout = new Layout({ width, height, pianoHeight: 220 });

const roll = new PianoRoll({ container: myStage, layout });
const keyboard = new Piano({ container: myStage, layout });
```

Passing one shared `Layout` is what keeps note columns and keys aligned.

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

| Import                              | What you get                                     |
| ----------------------------------- | ------------------------------------------------ |
| `piano-visualizer`                  | everything, named; default is `Visualization`    |
| `piano-visualizer/keyboard`         | keyboard rendering + pointer input               |
| `piano-visualizer/piano-roll`       | scrolling note blocks                            |
| `piano-visualizer/core`             | `Layout`, `Pitch`, `Stage`, color helpers        |
| `piano-visualizer/audio`            | `PianoAudio`, d-piano loader                     |

The package ships one file per module with `"sideEffects": false`, so named
imports from the root barrel shake as well as subpath imports. This is asserted
on every build by `npm run check:shaking`.

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
forceRedraw()
destroy()
```

`identifier` lets several sources (local user, remote peers, a score player)
hold the same note without fighting over it.

### `Piano` config

```typescript
{
  container: HTMLElement | Container; // element = standalone, container = embedded
  layout?: Layout;                    // required when container is a Container
  pianoHeight?: number | 'fill';      // default 'fill'
  range?: { centerMidi: number; visibleKeys: number };
  backgroundColor?: ColorSource;
  onKeyDown?: (midi: number) => void;
  onKeyUp?: (midi: number) => void;
}
```

### `PianoRoll` config

```typescript
{
  container: HTMLElement | Container;
  layout?: Layout;               // required when container is a Container
  pianoHeight?: number;          // space reserved for a keyboard, default 0
  range?: { centerMidi: number; visibleKeys: number };
  backgroundColor?: ColorSource;
}
```

### `Visualization` config

```typescript
{
  container: HTMLElement;
  backgroundColor?: ColorSource;   // 'transparent' for an alpha stage
  onKeyDown?: (midi: number) => string | undefined;
  onKeyUp?: (midi: number) => void;
}
```

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

## Experimental: WebGL2 backend (not published)

`src/gl/` holds a second renderer: a purpose-built WebGL2 instanced quad
renderer that draws the same scene as one draw call. It is excluded from
`dist/` and from every entry point — nothing shipped imports it. It exists to
answer a measurement question, and it is a prototype, not a supported API.

Measured on a real GPU (Chromium with ANGLE Metal on an Apple M4 Pro, 1000×700,
3s sample, both backends driven from an identical note schedule):
`npm run compare:backends`.

| Scene | Bundle min / gz | Renderer bytes | fps | frame avg / p99 | JS heap |
| --- | --- | --- | --- | --- | --- |
| keyboard, pixi | 491.7 kb / 142.2 kb | 1791.7 kb | 119.7 | 8.30 / 11.20 ms | 9.9 mb |
| keyboard, WebGL2 | 16.5 kb / 6.4 kb | 0 | 119.9 | 8.30 / 10.20 ms | 2.7 mb |
| full scene, pixi | 513.0 kb / 147.9 kb | 1791.7 kb | 119.7 | 8.30 / 10.70 ms | 25.1 mb |
| full scene, WebGL2 | 30.5 kb / 10.7 kb | 0 | 119.8 | 8.30 / 10.20 ms | 3.7 mb |

Both backends sit at vsync (this display runs at 120 Hz) and their frame
distributions are indistinguishable, at the keyboard and at the full scene. The
win is bytes and memory: **-93% gzipped and -85% JS heap** for the full scene.

The harness deliberately launches the full Chromium build. The headless shell
rasterises through SwiftShader, and under software rasterisation the pixi scene
drops to ~35 fps while the quad renderer holds vsync — a measurement of the CPU
pretending to be a GPU, not of the renderers. If you re-run this on a machine
without a GPU, expect that artefact and do not read frame rates from it.

What is ported: keyboard, note blocks with the three-stop gradient and glow
stack, background particles, backdrop, fade overlay, pointer input, and the
shared `GestureAnimator` / `VisualizationController` (both already pixi-free).
What is not: text, masks, render textures — the app never used them.

The particle simulation lives in `src/lib/particleField.ts` and is shared by
both backends, so the ambient background is identical either way.

## Development

```bash
npm install
npm run dev            # demo server (index.html, keyboard.html, *-gl.html)
npm run test           # unit tests
npm run typecheck
npm run build          # library → dist/
npm run build:demo     # demo site → demo-dist/
npm run check:shaking  # asserts the tree-shaking guarantees against dist/
npm run compare:backends  # pixi vs WebGL2 prototype: bytes, fps, heap
```

The library is emitted by `tsc` as one module per file — a pre-rolled bundle
cannot be tree shaken by a consumer's bundler, and composability is the point.
