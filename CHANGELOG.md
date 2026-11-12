# Changelog

## 2.0.0

The renderer is now a purpose-built WebGL2 quad renderer. PixiJS is removed
outright — it is no longer a dependency, a peer dependency, or reachable from
any entry point.

Validated against p2piano, the consumer this was built for, before release:

- keyboard and particles render **pixel-identical** to 1.2.1 (0.000% of pixels
  differing by more than 8 luma); note blocks match once scroll timing is
  accounted for, and better than two runs of 1.2.1 match each other
- no stuck keys through the colour-stack API under pointer drag, keyboard
  chords, or p2piano's double-render path
- p2piano's client bundle dropped **443 kb raw / 129 kb gz** (-22%), with
  `pixi.js` gone from its lockfile entirely and no callsite changes required

### Breaking

- **`pixi.js` is gone.** It was a peer dependency in 1.x. Uninstall it; nothing
  needs it.
- **WebGL2 is required, with no fallback.** `isWebGL2Supported()` and
  `WebGL2UnavailableError` are exported so a host can detect and degrade itself
  instead of receiving a blank canvas.
- **No embedding into a host scene graph.** `container` used to accept an
  `HTMLElement` or a Pixi `Container`. It now takes an `HTMLElement` only, and
  every module owns its own canvas. The `Stage` / `mount` helpers and
  `GraphicsPool` are removed from `piano-visualizer/core`.
- **Deep imports are blocked.** The `exports` map exposes `.`, `./keyboard`,
  `./piano-roll`, `./core` and `./audio`. `piano-visualizer/dist/…` is not part
  of the API.
- **Output is per-file ESM from `tsc`**, not a rolled Vite bundle. Required for
  the tree-shaking guarantees below; consumers on CommonJS need a bundler. The
  emitted modules resolve under plain Node ESM — every relative specifier
  carries an explicit `.js` — so the package works outside a bundler, and
  `check:package` fails the build if that ever stops being true.
- `forceRedraw()` is a no-op on every module. It existed to invalidate cached
  graphics; the new renderer rebuilds its instance buffer every frame. Kept so
  existing callsites compile.

### Added

- **Composable entry points.** `piano-visualizer/keyboard` and
  `piano-visualizer/piano-roll` construct standalone modules with their own
  canvas, resize observer, raf loop and pointer input. Keyboard-only costs
  43.4 kb of package code, roll-only 38.3 kb, the full composition 75.8 kb.
  Asserted on every build by `check:shaking`.
- **`piano-visualizer/audio`** — optional `d-piano` / `tone` sound behind its own
  entry, so audio never enters a render-only bundle.
- **Multi-touch.** One note per `pointerId`, so two fingers play a chord. A
  dragged finger glides across keys; lifting one finger releases only that
  finger's note.
- **Colour-stack key state.** A key can be held by several sources at once
  (`startNote(midi, color, id)` from a finger, a MIDI controller and a score
  player). Releasing one reveals the colour of whatever still holds the key
  instead of clearing it.
- **WebGL context-loss recovery.** Programs, buffers and the VAO are rebuilt on
  `webglcontextrestored`; `contextLost` reports the window where drawing is
  impossible.
- **`getBlockPositions()`** on `Visualization`, and `heldNotes`.
- **`Layout`, `Pitch`, `KeyState`, colour helpers and the WebGL2 capability
  check** are exported from `piano-visualizer/core`.

### Fixed

- Note-block gradients never rendered. The options-object `FillGradient` form
  used at construction is not supported by the pinned pixi release, and the
  throw was swallowed by a `try`/`catch`, so every block silently fell back to a
  flat fill. The new renderer draws the intended three-stop gradient.
- Standalone `Piano` and `PianoRoll` ignored the horizontal pan that `setRange`
  computes, so they never moved with the range.
- The full scene called `layout.getNoteRollHeight()`, which does not exist. It
  went unnoticed because the prototype directory was excluded from typechecking.
- Colour parsing covered hex and `rgb()` only, and returned white for anything
  else — including `hsl()` and every CSS colour name. It now parses the same
  surface the old renderer accepted and throws on garbage instead of painting
  white.

### Performance

Against the renderer this replaced, on a real GPU (Apple M4 Pro via ANGLE Metal,
1000×700, identical note schedule on both sides):

| Scene | Before | After | fps | JS heap |
| --- | --- | --- | --- | --- |
| keyboard | 491.7 kb / 142.2 kb gz | 16.5 kb / 6.4 kb gz | 119.7 → 119.9 | 9.9 mb → 2.7 mb |
| full scene | 513.0 kb / 147.9 kb gz | 30.5 kb / 10.7 kb gz | 119.7 → 119.8 | 25.1 mb → 3.7 mb |

Both backends sit at vsync with indistinguishable frame distributions. There is
no frame-rate win here; the win is -93% gzipped and -85% JS heap.

### Known issues

- `setRange(centerMidi, visibleKeys)` stores and reports `visibleKeys` verbatim,
  but the width factor derived from it is clamped so that between 5 and 52 keys
  fit on screen. Asking for 88 visible keys on a narrow viewport therefore
  reports 88 while rendering at roughly 52 keys' worth of width. This is
  unchanged from 1.x; it is left alone here deliberately, because changing
  rendering in the same release that replaced the renderer would make any visual
  difference impossible to attribute.

### Tooling

- `package.json` now declares `license: MIT`. The LICENSE file always said MIT,
  but the field was missing, so the registry listed every published version as
  unlicensed.
- pnpm is the package manager; `package-lock.json` is removed and
  `pnpm-workspace.yaml` carries a real `allowBuilds` entry for esbuild, which
  was what made `pnpm dev` fail with `ERR_PNPM_IGNORED_BUILDS`.
- CI runs typecheck, unit tests, build, the tree-shaking gate, the demo build and
  the Playwright acceptance suite with a real browser.
- `npm test`/`pnpm test` stays watch-mode; CI uses `test:run`.

## 1.2.1

Last release built on PixiJS.
