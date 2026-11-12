/**
 * keyboard drawing shared by every host.
 *
 * geometry comes from `Layout` and colour tokens from `PianoTheme`, so a
 * standalone keyboard and the full scene cannot drift apart. layering: natural
 * key shadow/body/stroke, then the accidental stack, then the frame bar.
 */
import Layout from '../Layout.js';
import Pitch from '../Pitch.js';
import { PianoTheme } from '../Piano/PianoTheme.js';
import type QuadRenderer from './QuadRenderer.js';
import { adjustColor } from './color.js';

export const MIDI_MIN = 21;
export const MIDI_MAX = 108;

export const SHAPE = {
  NATURAL_RADIUS: 4,
  ACCIDENTAL_RADIUS: 3,
  NATURAL_SHADOW: 3,
  ACCIDENTAL_SHADOW: 5,
  FRAME_HEIGHT: 8,
} as const;

export function keyRect(layout: Layout, midi: number) {
  const element = layout.getKeyElement(midi);
  return {
    x: element.x + layout.getX(),
    y: layout.getPianoY(),
    w: element.width,
    h: element.height,
  };
}

/** anything able to answer which colour a key is showing - a Map or a KeyState */
export type ActiveKeyLookup = {
  get(midi: number): string | undefined;
};

export function drawKeyboard(
  renderer: QuadRenderer,
  layout: Layout,
  active: ActiveKeyLookup,
): void {
  for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
    const pitch = new Pitch(midi);
    if (pitch.isNatural) {
      drawNatural(renderer, layout, pitch, active.get(midi));
    }
  }

  for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
    const pitch = new Pitch(midi);
    if (!pitch.isNatural) {
      drawAccidental(renderer, layout, pitch, active.get(midi));
    }
  }

  drawFrame(renderer, layout);
}

/** keys are laid out by formula, so hit testing is a containment scan */
export function midiAt(layout: Layout, x: number, y: number): number | null {
  for (let pass = 0; pass < 2; pass++) {
    const wantNatural = pass === 1;

    for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
      const pitch = new Pitch(midi);
      if (pitch.isNatural !== wantNatural) {
        continue;
      }

      const rect = keyRect(layout, midi);
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        return midi;
      }
    }
  }

  return null;
}

function drawNatural(
  renderer: QuadRenderer,
  layout: Layout,
  pitch: Pitch,
  active?: string,
): void {
  const { x, y, w, h } = keyRect(layout, pitch.midi);
  const radius = Math.min(SHAPE.NATURAL_RADIUS, w * 0.12, h * 0.04);
  const shadowDepth = Math.min(SHAPE.NATURAL_SHADOW, h * 0.03);
  const base = active ?? PianoTheme.natural.defaultBase;

  renderer.rect({
    x, y: y + shadowDepth, w, h, radius, color: PianoTheme.natural.shadow,
  });
  renderer.rect({
    x, y, w, h, radius,
    color: adjustColor(base, active ? 0.28 : 0.22),
    gradient: adjustColor(base, active ? -0.16 : -0.18),
    stroke: 1,
    strokeColor: PianoTheme.natural.border,
  });
}

function drawAccidental(
  renderer: QuadRenderer,
  layout: Layout,
  pitch: Pitch,
  active?: string,
): void {
  const { x, y, w, h } = keyRect(layout, pitch.midi);
  const radius = Math.min(SHAPE.ACCIDENTAL_RADIUS, w * 0.16, h * 0.045);
  const shadowDepth = Math.min(SHAPE.ACCIDENTAL_SHADOW, h * 0.04);
  const margin = Math.min(
    active ? 2 : 3,
    Math.max(0.5, w * 0.12, h * 0.015),
    w / 2,
  );
  const surfaceY = Math.min(3, h * 0.03);
  const surfaceHeight = active ? h - margin * 2 : h * 0.9;
  const surface = active ?? PianoTheme.accidental.defaultSurface;

  renderer.rect({
    x: x - 1, y: y + shadowDepth, w: w + 2, h: h + 2, radius,
    color: PianoTheme.accidental.deepShadow,
  });
  renderer.rect({
    x, y: y + shadowDepth - 2, w, h, radius,
    color: PianoTheme.accidental.secondaryShadow,
  });
  renderer.rect({
    x, y, w, h, radius, color: PianoTheme.accidental.mainBody,
  });
  renderer.rect({
    x: x + margin, y: y + surfaceY, w: w - margin * 2, h: surfaceHeight, radius,
    color: adjustColor(surface, 0.12),
    gradient: surface,
  });
  renderer.rect({
    x: x + margin, y: y + surfaceY + 1, w: 1, h: surfaceHeight * 0.5,
    color: active ? adjustColor(active, 0.1) : PianoTheme.accidental.leftBevel,
  });
  renderer.rect({
    x: x + w - margin - 1, y: y + surfaceY + 1, w: 1, h: surfaceHeight * 0.5,
    color: active ? adjustColor(active, 0.05) : PianoTheme.accidental.rightBevel,
  });
}

function drawFrame(renderer: QuadRenderer, layout: Layout): void {
  const first = layout.getKeyElement(MIDI_MIN);
  const last = layout.getKeyElement(MIDI_MAX);
  const pianoHeight = layout.getPianoHeight();
  const frameHeight = Math.min(SHAPE.FRAME_HEIGHT, pianoHeight * 0.032);

  renderer.rect({
    x: first.x + layout.getX(),
    y: layout.getPianoY() + pianoHeight - frameHeight / 2,
    w: last.x + last.width - first.x,
    h: frameHeight,
    color: '#05070a',
    alpha: 0.86,
  });
}
