import Pitch from './Pitch';

const NATURAL_KEY_WIDTH = 100;
const NATURAL_KEY_HEIGHT = 250;
const ACCIDENTAL_KEY_HEIGHT = NATURAL_KEY_HEIGHT * 0.68;
const ACCIDENTAL_KEY_WIDTH = NATURAL_KEY_WIDTH / 2;
const OCTAVE_WIDTH = NATURAL_KEY_WIDTH * 7;
const CHROMA_X_POSITIONS = [
    0,
    75,
    100,
    175,
    200,
    300,
    375,
    400,
    475,
    500,
    575,
    600,
] as const;

type KeyElement = {
    x: number,
    width: number,
    height: number,
}

export default class PianoLayout {
    private widthFactor: number;
    private heightFactor: number;
    private containerWidth: number;

    constructor(containerWidth: number) {
        this.widthFactor = 1;
        this.heightFactor = 1;
        this.containerWidth = containerWidth;
        this.setRange(15);
    }

    public setRange(diatonicRange: number) {
        const visibleKeys = this.containerWidth / NATURAL_KEY_WIDTH;
        this.widthFactor = visibleKeys / diatonicRange;
    }

    public setHeight(height: number) {
        this.heightFactor = height / NATURAL_KEY_HEIGHT;
    }

    public getKeyElement(midi: number): KeyElement {
        const pitch = new Pitch(midi);
        const x = CHROMA_X_POSITIONS[pitch.chroma] + pitch.octave * OCTAVE_WIDTH;
        const width = pitch.isNatural ? NATURAL_KEY_WIDTH : ACCIDENTAL_KEY_WIDTH;
        const height = pitch.isNatural ? NATURAL_KEY_HEIGHT : ACCIDENTAL_KEY_HEIGHT;

        return {
            x: x * this.widthFactor,
            width: width * this.widthFactor,
            height: height * this.heightFactor,
        };
    }
}