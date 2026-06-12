# Piano Visualizer — Visual Polish Spec

Reference mock: `mock-2.png` in repository root.

## Overview

Rendering changes to bring the visualizer's atmosphere in line with the
reference mock. The visual-polish items below are internal rendering changes
unless a specific modularization task says otherwise.

## Product Direction

The package should become a modular piano visualization toolkit rather than a
single hard-wired keyboard-plus-piano-roll screen. The immediate downstream
need is p2piano sheet-music mode: it needs to embed a compact live keyboard
below an OpenSheetMusicDisplay score without constructing or rendering the
piano-roll timeline.

The current visual polish work remains valid, but any structural refactor should
preserve a clean split between reusable rendering primitives and composed
experiences.

## Module Boundaries

The package should expose composable modules for:

- Keyboard rendering and pointer input.
- Active-note highlighting.
- MIDI note range and viewport control.
- Shared sizing and note/key alignment.
- Piano-roll timeline rendering.
- Full visualizer composition that combines keyboard plus piano roll.

The keyboard module must be independently usable in compact or docked contexts,
including a lower input strip under a sheet-music view. Consumers should be able
to construct the keyboard without constructing the piano-roll timeline, ambient
particles, falling notes, or roll-specific effects.

The piano-roll module is optional. It may be composed with the keyboard for the
full performance visualizer, but it must not own note input, host room state, or
audio scheduling. Package consumers own application state and pass projected
note state and callbacks into the package.

Shared visual concerns such as MIDI note range, active-note colors,
local/remote note projection, sizing, and pointer/keyboard input mapping should
live in package-level primitives that both keyboard-only and keyboard-plus-roll
compositions can reuse.

Package APIs should remain framework-agnostic where practical. Svelte lifecycle,
plugin wiring, room-specific controls, collaboration state, and audio behavior
belong in downstream app adapters, not in this package core.

The package must avoid assuming it owns a full-screen or full-main-surface
layout. Consumers should be able to embed modules in constrained layouts with
stable dimensions, including a compact lower keyboard strip. Resize and
`forceRedraw` flows must continue to work for both standalone modules and full
compositions.

## 1. Note glow and fade-out

**Current:** `PianoRoll.ts` renders each note block as a solid rounded rectangle with a hard `#2d2e2e` border stroke. All blocks are fully opaque regardless of vertical position.

**Target:** Each note block emits a soft colored glow into the surrounding dark space. Blocks also **fade out as they travel upward** — fully opaque near the keyboard, progressively transparent toward the top of the piano roll area.

### Approach

#### Glow layer

For each active or recently-created block, render a **glow layer** behind the crisp note shape:
- A second rounded rectangle, slightly larger than the note block (expand by ~4–6px on each side), filled with the note's color at ~0.25 alpha, with a `BlurFilter` applied (blur radius ~8–12px).
- Use a separate `Container` for glow graphics so blur doesn't affect the crisp note layer.
- Pool glow graphics alongside note graphics in `GraphicsPool` to avoid allocation churn.

#### Vertical alpha fade

- Compute each block's alpha as a function of its vertical position within the piano roll: `alpha = blockBottomY / pianoRollHeight`, clamped to [0.05, 1.0].
- Apply this alpha to **both** the crisp note graphic and its glow graphic each frame.
- The fade is continuous — no hard cutoff. Blocks near the keyboard are at full opacity; blocks near the top of the viewport approach near-invisible.

### Constraints

- Glow graphics must follow the same lifecycle as their parent block (created on `startNote`, removed when block scrolls offscreen).
- Keep blur radius modest to avoid GPU pressure — cap at 12px.
- The glow container must render **below** the note container in z-order.
- Alpha updates happen per-frame in `renderMidiBlocks` — use the existing `block.graphics.alpha` property rather than redrawing the shape.

### Files

- `src/PianoRoll.ts` — add glow container, glow graphics per block, blur filter.
- `src/lib/GraphicsPool.ts` — may need a second pool or parameterized pool for glow graphics.

## 2. Note border style

**Current:** Every note block has a 2px stroke in `#2d2e2e` (`PianoRoll.ts:236–238`), producing a hard dark outline that looks flat.

**Target:** Notes appear borderless or with a very subtle same-hue border that blends with the note color.

### Approach

Replace the current dark border with a **color-matched darkened border**:
- Derive the stroke color by darkening the note's fill color by ~30% (use a helper similar to `Piano.ts`'s `lightenColor` with a negative factor).
- Reduce stroke width from 2px to 1px.
- This keeps edges defined without the flat dark-gray outline.

### Files

- `src/PianoRoll.ts` — update `updateGraphics` to derive stroke color from fill color.
- Consider extracting `lightenColor` from `Piano.ts` into a shared utility in `src/lib/` since both `PianoRoll` and `Piano` will use it.

## 3. Active key color response

**Current:** Active piano keys are tinted with the player color, but the pressed
key can still look disconnected from the note column if the key material does
not pick up the same color.

**Target:** Pressed keys read as colored piano material under the falling note,
without a separate flashing light bar or upward color spill at the
piano-roll/keyboard boundary. The note block and its short trail provide the
motion; the key itself provides a contained color response.

### Approach

- Tint the active key surface with the active note color while preserving the
  natural/accidental key material gradients and outlines.
- Active natural keys should use a vertical color wash within the key face, not
  a separate boundary glow that flashes on/off.
- Do not render an upward color spill from the key into the piano roll.
- Do not render a bright horizontal strike-line bloom at the key top edge.
- Use the active key's current top color when multiple users press the same key.
- Keep the color response subtle enough that adjacent key outlines remain
  readable.

### Constraints

- Active-key tinting must follow the same lifecycle as `Piano.keyDown` /
  `Piano.keyUp`.
- Active-key rendering must not change the public `Visualization` constructor
  config.
- Alpha should be capped to avoid making sustained notes wash out the keyboard.

### Files

- `src/Piano/Piano.ts` — owns active key material tinting.
- `src/Layout.ts` — use existing key and roll geometry; do not introduce a new
  layout contract unless required.

## 4. Vertical note trails and light columns

**Current:** Note blocks exist as isolated rounded rectangles.

**Target:** Notes leave faint, translucent vertical columns behind them, giving
the scene depth without turning the roll into a solid colored band.

### Approach

- Render a low-alpha vertical trail for active and recently released notes,
  aligned to the same x/width as the note block.
- The trail should be much dimmer than the crisp block and use the note color.
- Trails fade with vertical position and should be strongest near active note
  blocks and the keyboard strike point.

### Constraints

- Trail graphics must render below crisp note blocks and above ambient
  particles.
- Trails must share note lifecycle cleanup with their parent blocks.
- Trails are visual only; they must not add note state or public API surface.

### Files

- `src/PianoRoll.ts` — add trail graphics/layer alongside note and glow
  graphics.
- `src/lib/GraphicsPool.ts` — pool trail graphics if a separate graphics object
  is used per note.

## 5. Background ambient particles

**Current:** The background behind the piano roll is a flat solid color (passed in by the host app, typically `#18181b`). There is no depth or atmosphere.

**Target:** Subtle, sparse dots of light scattered across the piano roll area,
slowly drifting to give depth. Particles should pick up nearby note/player color
when useful instead of reading as only white static.

### Approach

Add a `BackgroundParticles` class:
- On init, seed ~60–100 small circles (radius 1–2px, white or low-saturation
  player-tinted, alpha 0.05–0.20) at random positions within the piano roll
  bounds.
- Each particle drifts upward at a very slow constant speed (0.02–0.05 px/frame). When a particle exits the top, it wraps to the bottom with a new random x.
- Render into a dedicated `Container` placed behind the piano roll container but above the app background.
- Use a single `Graphics` object redrawn each frame (cheap for <100 circles) or a `ParticleContainer` if performance testing warrants it.

### Constraints

- Particles must not interfere with pointer events (set `interactiveChildren = false` on the particle container).
- Particle count and alpha should be subtle — this is ambient texture, not a focal element.
- Respect `layout.getPianoRollHeight()` for vertical bounds so particles don't overlap the keyboard.
- Particle color must remain low-alpha enough that it does not imply active note
  state.

### Files

- New file: `src/lib/BackgroundParticles.ts`
- `src/Visualization/Visualization.ts` — instantiate `BackgroundParticles`, add its container to the stage, call its `render(delta)` in the ticker loop.

## 6. Keyboard surface polish

**Current:** The keyboard has basic depth and active-key tinting, but the mock
has stronger material definition: glossy natural keys, beveled accidental keys,
a dark separator at the roll boundary, and shadow below the keyboard.

**Target:** The keyboard reads as a polished instrument surface under colored
stage lighting while retaining clear individual key boundaries.

### Approach

- Preserve the existing natural/accidental key z-ordering.
- Strengthen natural-key gradients just enough to show a glossy top highlight
  and bottom depth.
- Preserve black-key bevels and make their shadows visible against active color
  washes.
- Avoid a visible top separator over active columns; active note bars should
  visually meet the top of the pressed key with no dark gap.
- Add a bottom keyboard shadow/glow so the keyboard does not end abruptly.
- Active natural keys should show a colored vertical wash down the key, not only
  a flat color replacement.

### Constraints

- Key outlines must remain readable at full 88-key width.
- Active color treatment must work for both natural and accidental keys.
- Keyboard rendering remains owned by `Piano`; no plugin or host code should
  draw individual piano keys.

### Files

- `src/Piano/Piano.ts` — key gradients, bevels, active tint treatment.
- `src/Piano/PianoTheme.ts` — shared keyboard colors and shadow tokens.

## 7. Visual composition and sizing

**Current:** The spec describes individual effects, but not the overall scene
composition seen in the mock.

**Target:** The visualizer should feel full-bleed and cinematic: a dark
vignetted piano roll above a wide, grounded keyboard, with no decorative frame
around the core visualization.

### Approach

- Keep the piano roll background dark with a subtle vignette/depth gradient.
- Preserve enough roll height for falling notes and trails to breathe.
- Keep the keyboard visually anchored near the bottom, occupying a consistent
  proportion of the container.
- Use the existing `Layout` geometry as the source of truth for note/key
  alignment.

### Constraints

- Effects must respect resize and `forceRedraw` flows.
- No visual layer may overlap host toolbar/header UI; that remains outside this
  package.
- Do not add a new public sizing API unless implementation proves the existing
  layout contract cannot express the mock.

### Files

- `src/Layout.ts` — existing sizing and alignment rules.
- `src/Visualization/Visualization.ts` — stage-level background, layer order,
  and resize orchestration.

## Render layer order (bottom to top)

```
1. App background color
2. Scene vignette/depth gradient
3. BackgroundParticles container
4. PianoRoll trail/light-column container
5. PianoRoll glow container (blurred)
6. PianoRoll note container (crisp)
7. Active key upward spill, where z-ordering requires it behind notes
8. Piano keyboard container
9. Contained active key material tint
```

## Out of scope

- Toolbar/header UI changes (handled in the parent app).
- Any public API additions or changes to `Visualization`'s constructor config.
