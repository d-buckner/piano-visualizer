/**
 * piano renderer - draws the piano keys and tracks which ones are active.
 * uses separate containers for natural and accidental keys to handle z-ordering.
 * supports multiple colors per key and optional identifiers for complex scenarios.
 */
import { type ColorSource, Container, Graphics, FillGradient } from 'pixi.js';
import Layout from '../Layout';
import Pitch from '../Pitch';
import PianoController from './PianoController';
import { PianoTheme } from './PianoTheme';
import { adjustColor } from '../lib/color';

const MIDI_RANGE = {
    MIN: 21, // A0
    MAX: 108, // C8
    TOTAL_KEYS: 88
} as const;

const KEY_SHAPE = {
    NATURAL_RADIUS: 4,
    ACCIDENTAL_RADIUS: 3,
    NATURAL_SHADOW_DEPTH: 3,
    ACCIDENTAL_SHADOW_DEPTH: 5,
    ACCIDENTAL_IDLE_MARGIN: 3,
    ACCIDENTAL_ACTIVE_MARGIN: 2,
    ACCIDENTAL_SURFACE_Y: 3,
    FRAME_HEIGHT: 8,
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
    private naturalContainer: Container;
    private accidentalContainer: Container;
    private frameGraphics: Graphics;
    private graphics: Graphics[];
    private layout: Layout;
    private activeKeys: Map<number, ActiveKey[]> = new Map();
    private gradientCache: Map<string, FillGradient> = new Map();
    private dirtyKeys: Set<number> = new Set();
    private needsRedraw = true; // Initial render needed

    constructor(config: Config) {
        this.config = config;
        this.container = new Container();
        this.naturalContainer = new Container();
        this.accidentalContainer = new Container();
        this.frameGraphics = new Graphics();
        this.layout = config.layout;
        this.graphics = Array.from({ length: MIDI_RANGE.TOTAL_KEYS }, () => new Graphics());
        this.initializeKeyContainers();
        new PianoController({
            graphics: this.graphics,
            onKeyDown: this.config.onKeyDown,
            onKeyUp: this.config.onKeyUp,
            layout: this.config.layout,
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
        
        this.markKeyDirty(midi);
    }

    public keyUp(midi: number, identifier?: string) {
        if (!this.isValidMidi(midi)) return;

        const existingEntries = this.activeKeys.get(midi);
        if (!existingEntries) return;

        if (!identifier) {
            existingEntries.pop();
            if (existingEntries.length === 0) {
                this.activeKeys.delete(midi);
            }
            this.markKeyDirty(midi);
            return;
        }

        const indexToRemove = existingEntries.findIndex(
            (activeKey) => activeKey.identifier === identifier
        );
        if (indexToRemove === -1) return;

        existingEntries.splice(indexToRemove, 1);
        if (existingEntries.length === 0) {
            this.activeKeys.delete(midi);
        }
        this.markKeyDirty(midi);
    }

    public render() {
        if (!this.needsRedraw && this.dirtyKeys.size === 0) {
            return;
        }

        if (this.needsRedraw) {
            this.markAllKeysDirty();
        }

        this.dirtyKeys.forEach((midi) => {
            this.createKeyGraphic(new Pitch(midi));
        });
        this.dirtyKeys.clear();
        this.drawKeyboardFrame();

        const pianoY = this.layout.getPianoY();
        this.container.y = pianoY;
        
        this.needsRedraw = false;
    }

    public forceRedraw() {
        this.needsRedraw = true;
    }

    private initializeKeyContainers(): void {
        for (let key = 0; key < MIDI_RANGE.TOTAL_KEYS; key++) {
            const midi = key + MIDI_RANGE.MIN;
            const pitch = new Pitch(midi);
            const targetContainer = pitch.isNatural
                ? this.naturalContainer
                : this.accidentalContainer;

            targetContainer.addChild(this.graphics[key]);
            this.dirtyKeys.add(midi);
        }

        this.container.addChild(this.naturalContainer);
        this.container.addChild(this.accidentalContainer);
        this.container.addChild(this.frameGraphics);
        this.config.container.addChild(this.container);
    }

    private markAllKeysDirty(): void {
        for (let midi = MIDI_RANGE.MIN; midi <= MIDI_RANGE.MAX; midi++) {
            this.dirtyKeys.add(midi);
        }
    }

    private markKeyDirty(midi: number): void {
        this.dirtyKeys.add(midi);
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
        const radius = this.getScaledRadius(keyElement, KEY_SHAPE.NATURAL_RADIUS, 0.12, 0.04);
        const shadowDepth = this.getScaledLength(
            KEY_SHAPE.NATURAL_SHADOW_DEPTH,
            keyElement.height,
            0.03,
        );

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
        const naturalGradient = this.getOrCreateNaturalGradient(baseColor, Boolean(color));

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
        const radius = this.getScaledRadius(keyElement, KEY_SHAPE.ACCIDENTAL_RADIUS, 0.16, 0.045);
        const shadowDepth = this.getScaledLength(
            KEY_SHAPE.ACCIDENTAL_SHADOW_DEPTH,
            keyElement.height,
            0.04,
        );
        const maxShadowMargin = color
            ? KEY_SHAPE.ACCIDENTAL_ACTIVE_MARGIN
            : KEY_SHAPE.ACCIDENTAL_IDLE_MARGIN;
        const shadowMargin = Math.min(
            maxShadowMargin,
            Math.max(0.5, keyElement.width * 0.12, keyElement.height * 0.015),
            keyElement.width / 2,
        );
        const surfaceY = this.getScaledLength(
            KEY_SHAPE.ACCIDENTAL_SURFACE_Y,
            keyElement.height,
            0.03,
        );
        const surfaceHeight = color
            ? Math.max(0, keyElement.height - shadowMargin * 2)
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
        const surfaceWidth = Math.max(0, keyElement.width - shadowMargin * 2);
        const surfaceX = keyElement.x + shadowMargin;

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
                surfaceY + 1,
                bevelSize,
                surfaceHeight * 0.5,
                0,
            )
            .fill(color ? adjustColor(color, 0.1) : PianoTheme.accidental.leftBevel);

        // Right bevel (even more subtle)
        graphic
            .roundRect(
                keyElement.x + keyElement.width - shadowMargin - bevelSize,
                surfaceY + 1,
                bevelSize,
                surfaceHeight * 0.5,
                0,
            )
            .fill(color ? adjustColor(color, 0.05) : PianoTheme.accidental.rightBevel);

        return graphic;
    }

    private getScaledRadius(
        keyElement: KeyElement,
        maxRadius: number,
        widthRatio: number,
        heightRatio: number,
    ): number {
        if (keyElement.width <= 0 || keyElement.height <= 0) {
            return 0;
        }

        return Math.min(maxRadius, keyElement.width * widthRatio, keyElement.height * heightRatio);
    }

    private getScaledLength(maxLength: number, referenceLength: number, ratio: number): number {
        if (referenceLength <= 0) {
            return 0;
        }

        return Math.min(maxLength, referenceLength * ratio);
    }

    private getOrCreateGradient(baseColor: string): FillGradient {
        // Create a cache key based on the base color
        const cacheKey = `accidental-${baseColor}`;

        // Return existing gradient if already cached
        if (this.gradientCache.has(cacheKey)) {
            return this.gradientCache.get(cacheKey)!;
        }

        // Create new gradient with proper colors
        const topColor = adjustColor(baseColor, 0.12);
        const midColor = adjustColor(baseColor, 0.02);

        const gradient = new FillGradient(0, 0, 0, 1);
        gradient.addColorStop(0, topColor);      // Light at top
        gradient.addColorStop(0.3, midColor);   // Transition
        gradient.addColorStop(1, baseColor);    // Darker at bottom
        gradient.buildLinearGradient();

        // Cache the gradient for reuse
        this.gradientCache.set(cacheKey, gradient);
        return gradient;
    }

    private getOrCreateNaturalGradient(baseColor: string, isActive: boolean): FillGradient {
        // Create a cache key based on the base color
        const cacheKey = `natural-${baseColor}-${isActive ? 'active' : 'idle'}`;

        // Return existing gradient if already cached
        if (this.gradientCache.has(cacheKey)) {
            return this.gradientCache.get(cacheKey)!;
        }

        // Create subtle gradient for natural keys (top-to-bottom)
        const topColor = adjustColor(baseColor, isActive ? 0.28 : 0.22);
        const midColor = baseColor;                               // Base color in middle
        const bottomColor = adjustColor(baseColor, isActive ? -0.16 : -0.18);

        const gradient = new FillGradient(0, 0, 0, 1);
        gradient.addColorStop(0, topColor);       // Bright highlight at top
        if (isActive) {
            gradient.addColorStop(0.08, adjustColor(baseColor, 0.45));
        }
        gradient.addColorStop(0.38, midColor);    // Base color
        if (!isActive) {
            gradient.addColorStop(0.78, adjustColor(baseColor, -0.08));
        }
        gradient.addColorStop(1, bottomColor);   // Subtle shadow at bottom
        gradient.buildLinearGradient();

        // Cache the gradient for reuse
        this.gradientCache.set(cacheKey, gradient);
        return gradient;
    }

    private drawKeyboardFrame(): void {
        const firstKey = this.layout.getKeyElement(MIDI_RANGE.MIN);
        const lastKey = this.layout.getKeyElement(MIDI_RANGE.MAX);
        const width = lastKey.x + lastKey.width - firstKey.x;
        const frameHeight = this.getScaledLength(
            KEY_SHAPE.FRAME_HEIGHT,
            this.layout.getPianoHeight(),
            0.032,
        );
        const bottomY = this.layout.getPianoHeight() - frameHeight / 2;

        this.frameGraphics.clear();
        this.frameGraphics.rect(firstKey.x, bottomY, width, frameHeight).fill({
            color: '#05070a',
            alpha: 0.86,
        });
    }

    public destroy(): void {
        // Clean up cached gradients to prevent memory leaks
        this.gradientCache.forEach(gradient => {
            if (gradient.texture) {
                gradient.texture.destroy();
            }
        });
        this.gradientCache.clear();
        this.frameGraphics.destroy();
    }
}
