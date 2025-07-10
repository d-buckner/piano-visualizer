/**
 * piano renderer - draws the piano keys and tracks which ones are active.
 * uses separate containers for natural and accidental keys to handle z-ordering.
 * supports multiple colors per key and optional identifiers for complex scenarios.
 */
import {type ColorSource, Container, Graphics} from 'pixi.js';
import Layout from '../Layout';
import Pitch from '../Pitch';
import PianoController from './PianoController';

const MIDI_RANGE = {
  MIN: 21, // A0
  MAX: 108, // C8
  TOTAL_KEYS: 88
} as const;

type Config = {
    container: Container;
    backgroundColor?: ColorSource;
    layout: Layout;
    onKeyDown: (midi: number) => void;
    onKeyUp: (midi: number) => void;
};

type ActiveKey = {
    color: string;
    midi: number;
    identifier?: string;
}

type KeyElement = {
    x: number;
    width: number;
    height: number;
}

export default class Piano {
    private config: Config;
    private container: Container;
    private pianoController: PianoController;
    private graphics: Graphics[];
    private layout: Layout;
    private activeKeys: Map<number, ActiveKey[]> = new Map();

    constructor(config: Config) {
        this.config = config;
        this.container = new Container();
        this.layout = config.layout;
        this.graphics = Array.from({length: 89}, () => new Graphics());
        this.pianoController = new PianoController({
            graphics: this.graphics,
            onKeyDown: this.config.onKeyDown,
            onKeyUp: this.config.onKeyUp,
            pianoY: this.config.layout.getPianoY(),
        });
        this.render();
    }

    public keyDown(midi: number, color: string, identifier?: string) {
        if (!this.isValidMidi(midi)) return;

        if (!this.activeKeys.has(midi)) {
            this.activeKeys.set(midi, []);
        }

        this.activeKeys.get(midi)!.push({
            color,
            midi,
            identifier,
        });
    }

    public keyUp(midi: number, identifier?: string) {
        if (!this.isValidMidi(midi)) return;

        const existingEntries = this.activeKeys.get(midi);
        if (!existingEntries) {
            return;
        }

        if (!identifier) {
            if (existingEntries.length === 1) {
                this.activeKeys.delete(midi);
                return;
            }

            this.activeKeys.get(midi)!.pop();
        }

        const newActiveKeys = this.activeKeys
            .get(midi)
            ?.filter((activeKey) => activeKey.identifier !== identifier);
        if (!newActiveKeys?.length) {
            this.activeKeys.delete(midi);
            return;
        }

        this.activeKeys.set(midi, newActiveKeys);
    }

    public render() {
        const prevKeyContainer = this.container;

        this.container = new Container();
        const naturalContainer = new Container();
        const accidentalContainer = new Container();

        for (let key = 0; key < 87; key++) {
            const pitch = new Pitch(key + 21);
            const keyGraphic = this.createKeyGraphic(pitch);
            this.graphics[key] = keyGraphic;
            const targetContainer = pitch.isNatural
                ? naturalContainer
                : accidentalContainer;
            targetContainer.addChild(keyGraphic);
        }

        this.container.addChild(naturalContainer);
        this.container.addChild(accidentalContainer);
        this.config.container.removeChild(prevKeyContainer);
        this.config.container.addChild(this.container);

        const pianoY = this.layout.getPianoY();
        this.container.y = pianoY;
        this.pianoController.updatePianoY(pianoY);
    }

    private isValidMidi(midi: number): boolean {
        if (midi < MIDI_RANGE.MIN || midi > MIDI_RANGE.MAX) {
            console.warn(`Invalid MIDI note: ${midi}. Valid range is ${MIDI_RANGE.MIN}-${MIDI_RANGE.MAX}`);
            return false;
        }
        return true;
    }

    private createKeyGraphic(pitch: Pitch) {
        const keyElement = this.layout.getKeyElement(pitch.midi);
        const graphic = this.graphics[pitch.midi - 21];
        const activeKeys = this.activeKeys.get(pitch.midi);
        const activeKey = activeKeys?.[activeKeys.length - 1];
        const color = activeKey?.color;
        graphic.clear();

        if (pitch.isNatural) {
            return this.createNaturalKeyGraphic(graphic, keyElement, color);
        }

        return this.createAccidentalKeyGraphic(graphic, keyElement, color);
    }

    private createNaturalKeyGraphic(graphic: Graphics, keyElement: KeyElement, color?: string) {
        const radius = 4;
        const shadowDepth = 3;
        const highlightHeight = 8;

        // Bottom shadow for depth
        graphic
            .roundRect(
                keyElement.x, 
                shadowDepth, 
                keyElement.width, 
                keyElement.height, 
                radius
            )
            .fill('#d0d0d0');

        // Main key body
        graphic
            .roundRect(keyElement.x, 0, keyElement.width, keyElement.height, radius)
            .fill(color ?? '#f8f8f8');

        // Top highlight for 3D effect
        graphic
            .roundRect(
                keyElement.x + 1, 
                1, 
                keyElement.width - 2, 
                highlightHeight, 
                radius
            )
            .fill(color ? this.lightenColor(color, 0.2) : '#ffffff');

        // Border
        graphic
            .roundRect(keyElement.x, 0, keyElement.width, keyElement.height, radius)
            .stroke({ width: 1, color: '#999999' });

        return graphic;
    }

    private createAccidentalKeyGraphic(graphic: Graphics, keyElement: KeyElement, color?: string) {
        const radius = 2;
        const shadowDepth = 4;
        const shadowMargin = color ? 2 : 4;
        const shadowHeight = color
            ? keyElement.height - shadowMargin * 2
            : keyElement.height / 1.0625;

        // Bottom shadow for depth
        graphic
            .roundRect(
                keyElement.x, 
                shadowDepth, 
                keyElement.width, 
                keyElement.height, 
                radius
            )
            .fill('#1a1a1a');

        // Main key body
        graphic
            .roundRect(keyElement.x, 0, keyElement.width, keyElement.height, radius)
            .fill('#2a2a2a');

        // Inner surface with color or default
        graphic
            .roundRect(
                keyElement.x + shadowMargin,
                2,
                keyElement.width - shadowMargin * 2,
                shadowHeight,
                radius * 1.5,
            )
            .fill(color ?? '#3a3a3a');

        // Subtle highlight on top edge
        if (!color) {
            graphic
                .roundRect(
                    keyElement.x + shadowMargin + 1,
                    2,
                    keyElement.width - shadowMargin * 2 - 2,
                    3,
                    radius,
                )
                .fill('#4a4a4a');
        }

        return graphic;
    }

    private lightenColor(color: string, factor: number): string {
        // Simple color lightening - converts hex to lighter version
        if (!color.startsWith('#')) return color;
        
        const num = parseInt(color.slice(1), 16);
        const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * factor));
        const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * factor));
        const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * factor));
        
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
}
