/**
 * piano renderer - draws the piano keys and tracks which ones are active.
 * uses separate containers for natural and accidental keys to handle z-ordering.
 * supports multiple colors per key and optional identifiers for complex scenarios.
 */
import { type ColorSource, Container, Graphics, FillGradient, Color } from 'pixi.js';
import Layout from '../Layout';
import Pitch from '../Pitch';
import PianoController from './PianoController';
import { PianoTheme } from './PianoTheme';

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
    private gradientCache: Map<string, FillGradient> = new Map();
    private needsRedraw = true; // Initial render needed

    constructor(config: Config) {
        this.config = config;
        this.container = new Container();
        this.layout = config.layout;
        this.graphics = Array.from({ length: MIDI_RANGE.TOTAL_KEYS }, () => new Graphics());
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
        
        this.needsRedraw = true;
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
                this.needsRedraw = true;
                return;
            }

            this.activeKeys.get(midi)!.pop();
            this.needsRedraw = true;
            return;
        }

        const newActiveKeys = this.activeKeys
            .get(midi)
            ?.filter((activeKey) => activeKey.identifier !== identifier);
        if (!newActiveKeys?.length) {
            this.activeKeys.delete(midi);
            this.needsRedraw = true;
            return;
        }

        this.activeKeys.set(midi, newActiveKeys);
        this.needsRedraw = true;
    }

    public render() {
        if (!this.needsRedraw) {
            return;
        }

        const prevKeyContainer = this.container;

        this.container = new Container();
        const naturalContainer = new Container();
        const accidentalContainer = new Container();

        for (let key = 0; key < MIDI_RANGE.TOTAL_KEYS; key++) {
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
        
        this.needsRedraw = false;
    }

    public forceRedraw() {
        this.needsRedraw = true;
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

        // Bottom shadow for depth
        graphic
            .roundRect(
                keyElement.x,
                shadowDepth,
                keyElement.width,
                keyElement.height,
                radius
            )
            .fill(PianoTheme.natural.shadow);

        // Main key body with gradient for realistic appearance
        const baseColor = color ?? PianoTheme.natural.defaultBase;
        const naturalGradient = this.getOrCreateNaturalGradient(baseColor);

        graphic
            .roundRect(keyElement.x, 0, keyElement.width, keyElement.height, radius)
            .fill(naturalGradient);

        // Border
        graphic
            .roundRect(keyElement.x, 0, keyElement.width, keyElement.height, radius)
            .stroke({ width: 1, color: PianoTheme.natural.border });

        return graphic;
    }

    private createAccidentalKeyGraphic(graphic: Graphics, keyElement: KeyElement, color?: string) {
        const radius = 3;
        const shadowDepth = 5;
        const shadowMargin = color ? 2 : 3;
        const surfaceHeight = color
            ? keyElement.height - shadowMargin * 2
            : keyElement.height * 0.9;

        // Deep bottom shadow for realistic depth
        graphic
            .roundRect(
                keyElement.x - 1,
                shadowDepth,
                keyElement.width + 2,
                keyElement.height + 2,
                radius
            )
            .fill(PianoTheme.accidental.deepShadow);

        // Secondary shadow layer
        graphic
            .roundRect(
                keyElement.x,
                shadowDepth - 2,
                keyElement.width,
                keyElement.height,
                radius
            )
            .fill(PianoTheme.accidental.secondaryShadow);

        // Main key body with gradient-like effect
        graphic
            .roundRect(keyElement.x, 0, keyElement.width, keyElement.height, radius)
            .fill(PianoTheme.accidental.mainBody);

        // Glossy surface with smooth gradient
        const surfaceColor = color ?? PianoTheme.accidental.defaultSurface;
        const surfaceWidth = keyElement.width - shadowMargin * 2;
        const surfaceX = keyElement.x + shadowMargin;
        const surfaceY = 3;

        // Get cached gradient to prevent memory leaks
        const gradient = this.getOrCreateGradient(surfaceColor);

        graphic
            .roundRect(
                surfaceX,
                surfaceY,
                surfaceWidth,
                surfaceHeight,
                radius,
            )
            .fill(gradient);

        // Very subtle side bevels for 3D effect
        const bevelSize = 1;
        // Left bevel (very subtle)
        graphic
            .roundRect(
                keyElement.x + shadowMargin,
                4,
                bevelSize,
                surfaceHeight * 0.5,
                0,
            )
            .fill(color ? this.lightenColor(color, 0.1) : PianoTheme.accidental.leftBevel);

        // Right bevel (even more subtle)
        graphic
            .roundRect(
                keyElement.x + keyElement.width - shadowMargin - bevelSize,
                4,
                bevelSize,
                surfaceHeight * 0.5,
                0,
            )
            .fill(color ? this.lightenColor(color, 0.05) : PianoTheme.accidental.rightBevel);

        return graphic;
    }

    private lightenColor(color: string, factor: number): string {
        // Use PixiJS Color class for proper color manipulation
        const pixiColor = new Color(color);

        if (factor >= 0) {
            // Lighten: blend with white
            const white = new Color(0xffffff);
            const [r, g, b, a] = pixiColor.toArray();
            const blendedR = r + (white.red - r) * factor;
            const blendedG = g + (white.green - g) * factor;
            const blendedB = b + (white.blue - b) * factor;

            return new Color([blendedR, blendedG, blendedB, a]).toHex();
        } else {
            // Darken: blend with black
            const [r, g, b, a] = pixiColor.toArray();
            const darkenFactor = 1 + factor; // Convert negative factor to positive

            return new Color([r * darkenFactor, g * darkenFactor, b * darkenFactor, a]).toHex();
        }
    }

    private getOrCreateGradient(baseColor: string): FillGradient {
        // Create a cache key based on the base color
        const cacheKey = `accidental-${baseColor}`;

        // Return existing gradient if already cached
        if (this.gradientCache.has(cacheKey)) {
            return this.gradientCache.get(cacheKey)!;
        }

        // Create new gradient with proper colors
        const topColor = this.lightenColor(baseColor, 0.12);
        const midColor = this.lightenColor(baseColor, 0.02);

        const gradient = new FillGradient(0, 0, 0, 1);
        gradient.addColorStop(0, topColor);      // Light at top
        gradient.addColorStop(0.3, midColor);   // Transition
        gradient.addColorStop(1, baseColor);    // Darker at bottom
        gradient.buildLinearGradient();

        // Cache the gradient for reuse
        this.gradientCache.set(cacheKey, gradient);
        return gradient;
    }

    private getOrCreateNaturalGradient(baseColor: string): FillGradient {
        // Create a cache key based on the base color
        const cacheKey = `natural-${baseColor}`;

        // Return existing gradient if already cached
        if (this.gradientCache.has(cacheKey)) {
            return this.gradientCache.get(cacheKey)!;
        }

        // Create subtle gradient for natural keys (top-to-bottom)
        const topColor = this.lightenColor(baseColor, 0.15);     // Brighter highlight at top
        const midColor = baseColor;                               // Base color in middle
        const bottomColor = this.lightenColor(baseColor, -0.05); // Slightly darker at bottom

        const gradient = new FillGradient(0, 0, 0, 1);
        gradient.addColorStop(0, topColor);       // Bright highlight at top
        gradient.addColorStop(0.4, midColor);    // Base color
        gradient.addColorStop(1, bottomColor);   // Subtle shadow at bottom
        gradient.buildLinearGradient();

        // Cache the gradient for reuse
        this.gradientCache.set(cacheKey, gradient);
        return gradient;
    }

    public destroy(): void {
        // Clean up cached gradients to prevent memory leaks
        this.gradientCache.forEach(gradient => {
            if (gradient.texture) {
                gradient.texture.destroy();
            }
        });
        this.gradientCache.clear();
    }
}
