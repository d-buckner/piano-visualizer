const NATURAL_CHROMA = new Set([0, 2, 4, 5, 7, 9, 11]);

export default class Pitch {
    public readonly midi: number;
    public readonly chroma : number;
    public readonly octave: number
    public readonly key: number;
    public readonly isNatural: boolean;

    constructor(midi: number) {
        this.midi = midi;
        this.chroma = midi % 12;
        this.octave = Math.floor(midi / 12);
        this.key = midi - 21;
        this.isNatural = NATURAL_CHROMA.has(this.chroma);
    }
}