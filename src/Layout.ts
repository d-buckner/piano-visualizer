import Pitch from './Pitch';

const NATURAL_KEY_WIDTH = 100;
const NATURAL_KEY_HEIGHT = 250;
// start view at middle c
const DEFAULT_X_OFFSET = 35 * NATURAL_KEY_WIDTH;
const ACCIDENTAL_KEY_HEIGHT = NATURAL_KEY_HEIGHT * 0.65;
const ACCIDENTAL_KEY_WIDTH = NATURAL_KEY_WIDTH / 2;
const OCTAVE_WIDTH = NATURAL_KEY_WIDTH * 7;
const CHROMA_X_POSITIONS = [
  0, 75, 100, 175, 200, 300, 375, 400, 475, 500, 575, 600,
] as const;
const X_OFFSET_CHROMA = new Set([2, 4, 7, 9, 11]);
const WIDE_ACCIDENTAL_CHROMA = new Set([0, 4, 5, 11]);
const BREAKPOINT_RANGES = [
  [700, 8],
  [1200, 12],
  [1600, 16],
];

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

export default class Layout {
  private pianoHeight: number;
  private height: number;
  private widthFactor: number;
  private heightFactor: number;
  private width: number;
  private x: number;
  private diatonicRange: number;

  constructor(config: Config) {
    this.widthFactor = 1;
    this.heightFactor = 1;
    this.width = config.width;
    this.height = config.height;
    this.x = 0;
    this.pianoHeight = config.pianoHeight;
    this.updatePianoHeight(this.pianoHeight);
    this.diatonicRange = this.getBreakpointRange();
    this.setDiatonicRange(this.diatonicRange);
  }

  public setWidth(width: number) {
    const lastRangeFromWidth = this.getBreakpointRange();
    this.width = width;
    const newRangeFromWidth = this.getBreakpointRange();
    const targetRange =
      lastRangeFromWidth === newRangeFromWidth
        ? this.diatonicRange
        : newRangeFromWidth;

    this.setDiatonicRange(targetRange);
  }

  public setHeight(height: number) {
    this.height = height;
  }

  public setX(x: number) {
    this.x = x;
  }

  public getX(): number {
    return this.x;
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

  public setDiatonicRange(diatonicRange: number) {
    this.diatonicRange = diatonicRange;
    const visibleKeys = this.width / NATURAL_KEY_WIDTH;
    this.widthFactor = visibleKeys / diatonicRange;
  }

  public getDiatonicRange(): number {
    return this.diatonicRange;
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

  private getBreakpointRange(): number {
    for (const [breakpoint, range] of BREAKPOINT_RANGES) {
      if (this.width < breakpoint) {
        return range;
      }
    }

    return 16;
  }
}
