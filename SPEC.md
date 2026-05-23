# Piano Visualizer — Visual Polish Spec

Reference mock: `mock1.png` in repository root.

## Overview

Three rendering changes to bring the visualizer's atmosphere in line with the reference mock. All changes are internal to this package — no public API changes.

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

## 3. Background ambient particles

**Current:** The background behind the piano roll is a flat solid color (passed in by the host app, typically `#18181b`). There is no depth or atmosphere.

**Target:** Subtle, sparse dots of light scattered across the piano roll area, slowly drifting to give depth.

### Approach

Add a `BackgroundParticles` class:
- On init, seed ~60–100 small circles (radius 1–2px, white, alpha 0.05–0.20) at random positions within the piano roll bounds.
- Each particle drifts upward at a very slow constant speed (0.02–0.05 px/frame). When a particle exits the top, it wraps to the bottom with a new random x.
- Render into a dedicated `Container` placed behind the piano roll container but above the app background.
- Use a single `Graphics` object redrawn each frame (cheap for <100 circles) or a `ParticleContainer` if performance testing warrants it.

### Constraints

- Particles must not interfere with pointer events (set `interactiveChildren = false` on the particle container).
- Particle count and alpha should be subtle — this is ambient texture, not a focal element.
- Respect `layout.getPianoRollHeight()` for vertical bounds so particles don't overlap the keyboard.

### Files

- New file: `src/lib/BackgroundParticles.ts`
- `src/Visualization/Visualization.ts` — instantiate `BackgroundParticles`, add its container to the stage, call its `render(delta)` in the ticker loop.

## Render layer order (bottom to top)

```
1. App background color
2. BackgroundParticles container
3. PianoRoll glow container (blurred)
4. PianoRoll note container (crisp)
5. Piano keyboard container
```

## Out of scope

- Toolbar/header UI changes (handled in the parent app).
- Active key glow spill (upward color bleed from pressed keys) — deferred to a follow-up.
- Any public API additions or changes to `Visualization`'s constructor config.
