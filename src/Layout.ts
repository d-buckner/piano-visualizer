/**
 * layout calculations - handles responsive sizing and coordinate conversions.
 * calculates where keys should be positioned and manages viewport scaling.
 * adapts the visible key range based on screen width.
 */
import Pitch from './Pitch';

const PIANO_DIMENSIONS = {
  NATURAL_KEY_WIDTH: 100,
  NATURAL_KEY_HEIGHT: 250,
  ACCIDENTAL_HEIGHT_RATIO: 0.65,
  ACCIDENTAL_WIDTH_RATIO: 0.5,
  OCTAVE_WIDTH_MULTIPLIER: 7,
  MIDDLE_C_OFFSET: 35
} as const;

const NATURAL_KEY_WIDTH = PIANO_DIMENSIONS.NATURAL_KEY_WIDTH;
const NATURAL_KEY_HEIGHT = PIANO_DIMENSIONS.NATURAL_KEY_HEIGHT;
const DEFAULT_X_OFFSET = PIANO_DIMENSIONS.MIDDLE_C_OFFSET * NATURAL_KEY_WIDTH;
const ACCIDENTAL_KEY_HEIGHT = NATURAL_KEY_HEIGHT * PIANO_DIMENSIONS.ACCIDENTAL_HEIGHT_RATIO;
const ACCIDENTAL_KEY_WIDTH = NATURAL_KEY_WIDTH * PIANO_DIMENSIONS.ACCIDENTAL_WIDTH_RATIO;
const OCTAVE_WIDTH = NATURAL_KEY_WIDTH * PIANO_DIMENSIONS.OCTAVE_WIDTH_MULTIPLIER;
const CHROMA_X_POSITIONS = [
  0, 75, 100, 175, 200, 300, 375, 400, 475, 500, 575, 600,
] as const;
const X_OFFSET_CHROMA = new Set([2, 4, 7, 9, 11]);
const WIDE_ACCIDENTAL_CHROMA = new Set([0, 4, 5, 11]);
const BREAKPOINT_RANGES = [
  [700, 8],
  [1200, 12],
  [1600, 16],
] as const;
const MIN_X = NATURAL_KEY_WIDTH * -12;
const MAX_X = NATURAL_KEY_WIDTH * 23;

export enum Section {
  PIANO_ROLL = 'PIANO_ROLL',
  PIANO = 'PIANO',
}

type KeyElement = {
  x: number;
  width: number;
  height: number;
};

type RollElement = {
  x: number;
  width: number;
};

type Config = {
  width: number;
  height: number;
  pianoHeight: number;
};

type Range = {
  centerMidi: number;
  visibleKeys: number;
};

export default class Layout {
  private pianoHeight: number;
  private height: number;
  private widthFactor: number;
  private heightFactor: number;
  private width: number;
  private x: number;
  private range: Range;

  constructor(config: Config) {
    this.widthFactor = 1;
    this.heightFactor = 1;
    this.width = config.width;
    this.height = config.height;
    this.x = 0;
    this.pianoHeight = config.pianoHeight;
    this.updatePianoHeight(this.pianoHeight);
    const breakpointRange = this.getBreakpointRange();
    this.range = {
      centerMidi: 60, // Middle C default
      visibleKeys: breakpointRange,
    };
    this.setVisibleKeys(breakpointRange);
  }

  public setWidth(width: number) {
    const lastRangeFromWidth = this.getBreakpointRange();
    this.width = width;
    const newRangeFromWidth = this.getBreakpointRange();
    const targetRange =
      lastRangeFromWidth === newRangeFromWidth
        ? this.range.visibleKeys
        : newRangeFromWidth;

    this.setVisibleKeys(targetRange);
  }

  public setHeight(height: number) {
    this.height = height;
  }

  public setX(x: number) {
    this.x = this.getClampedX(x);
  }

  public getX(): number {
    return this.x;
  }

  public getClampedX(x: number): number {
    return Math.max(
      MIN_X * this.widthFactor,
      Math.min(MAX_X * this.widthFactor, x)
    );
  }

  public getPianoRollHeight() {
    return this.getPianoY();
  }

  public getSection(y: number): Section {
    if (y < this.getPianoRollHeight()) {
      return Section.PIANO_ROLL;
    }

    return Section.PIANO;
  }

  public getQuantizedX(x: number) {
    const keyWidth = NATURAL_KEY_WIDTH * this.widthFactor;
    return Math.round(x / keyWidth) * keyWidth;
  }

  public getHeight(): number {
    return this.height;
  }

  public getPianoHeight(): number {
    return this.pianoHeight;
  }

  public getPianoY(): number {
    return this.height - this.pianoHeight;
  }

  public setVisibleKeys(visibleKeys: number) {
    this.range.visibleKeys = visibleKeys;
    const screenKeys = this.width / NATURAL_KEY_WIDTH;
    this.widthFactor = screenKeys / visibleKeys;
  }

  public getVisibleKeys(): number {
    return this.range.visibleKeys;
  }

  public updatePianoHeight(pianoHeight: number) {
    this.pianoHeight = pianoHeight;
    this.heightFactor = pianoHeight / NATURAL_KEY_HEIGHT;
  }

  public getKeyElement(midi: number): KeyElement {
    const pitch = new Pitch(midi);
    const x = CHROMA_X_POSITIONS[pitch.chroma] + pitch.octave * OCTAVE_WIDTH;
    const width = pitch.isNatural ? NATURAL_KEY_WIDTH : ACCIDENTAL_KEY_WIDTH;
    const height = pitch.isNatural ? NATURAL_KEY_HEIGHT : ACCIDENTAL_KEY_HEIGHT;

    return {
      x: (x - DEFAULT_X_OFFSET) * this.widthFactor,
      width: width * this.widthFactor,
      height: height * this.heightFactor,
    };
  }

  public getRollElement(midi: number): RollElement {
    const pitch = new Pitch(midi);
    const x = CHROMA_X_POSITIONS[pitch.chroma] + pitch.octave * OCTAVE_WIDTH;
    const width = WIDE_ACCIDENTAL_CHROMA.has(pitch.chroma)
      ? (ACCIDENTAL_KEY_WIDTH + NATURAL_KEY_WIDTH) / 2
      : ACCIDENTAL_KEY_WIDTH;
    const xOffset = X_OFFSET_CHROMA.has(pitch.chroma)
      ? (NATURAL_KEY_WIDTH - ACCIDENTAL_KEY_WIDTH) / 2
      : 0;

    return {
      x: (x + xOffset - DEFAULT_X_OFFSET) * this.widthFactor,
      width: width * this.widthFactor,
    };
  }

  // Center-point based methods (parallel to X coordinate system)
  public setCenterMidi(midi: number): void {
    if (midi < 21 || midi > 108) {
      console.warn(`Center MIDI ${midi} outside valid range 21-108`);
      return;
    }
    this.range.centerMidi = midi;
  }

  public getCenterMidi(): number {
    return this.range.centerMidi;
  }

  public getQuantizedCenterMidi(): number {
    // Convert to X, quantize visually, then convert back to MIDI
    const x = this.centerMidiToX(this.range.centerMidi);
    const quantizedX = this.getQuantizedX(x);
    return this.xToCenterMidi(quantizedX);
  }

  public setRange(centerMidi: number, visibleKeys: number): void {
    // Validate inputs
    if (centerMidi < 21 || centerMidi > 108) {
      console.warn(`Center MIDI ${centerMidi} outside valid range 21-108`);
      return;
    }
    if (visibleKeys < 4 || visibleKeys > 88) {
      console.warn(`Visible keys ${visibleKeys} outside valid range 4-88`);
      return;
    }

    // Set the center point and visible keys
    this.range.centerMidi = centerMidi;
    this.range.visibleKeys = visibleKeys;

    // Update the visible keys (this will sync range.visibleKeys)
    this.setVisibleKeys(visibleKeys);

    // Calculate the X offset needed to center the specified MIDI note
    const targetX = this.centerMidiToX(centerMidi);
    this.setX(targetX);
  }

  public getRange(): Range {
    return this.range as const;
  }

  public xToCenterMidi(x: number): number {
    // Convert X coordinate to center MIDI note
    const screenCenterX = this.width / 2;
    const offsetX = (x + screenCenterX) / this.widthFactor + DEFAULT_X_OFFSET;
    
    // Find closest MIDI note to this X position
    let closestMidi = 60;
    let closestDistance = Infinity;
    
    for (let midi = 21; midi <= 108; midi++) {
      const pitch = new Pitch(midi);
      const noteX = CHROMA_X_POSITIONS[pitch.chroma] + pitch.octave * OCTAVE_WIDTH;
      const distance = Math.abs(noteX - offsetX);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestMidi = midi;
      }
    }
    
    return closestMidi;
  }

  public centerMidiToX(midi: number): number {
    // Convert center MIDI note to X coordinate that would center that note on screen
    const pitch = new Pitch(midi);
    const noteX = CHROMA_X_POSITIONS[pitch.chroma] + pitch.octave * OCTAVE_WIDTH;
    const scaledNoteX = (noteX - DEFAULT_X_OFFSET) * this.widthFactor;
    const screenCenterX = this.width / 2;
    
    // Return the X offset needed to center this MIDI note
    return scaledNoteX - screenCenterX;
  }

  private getBreakpointRange(): number {
    for (const [breakpoint, range] of BREAKPOINT_RANGES) {
      if (this.width < breakpoint) {
        return range;
      }
    }

    return 16;
  }
}
