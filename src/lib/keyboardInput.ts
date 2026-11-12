/**
 * Pointer input for the keyboard: one note per pointer, so two fingers play a
 * chord instead of the second finger releasing the first.
 *
 * Pointer Events unify mouse and touch, so there is one map of live pointers
 * rather than separate mouse and touch bookkeeping. A mouse drag across keys
 * glides the same way a finger does.
 */
import Layout from '../Layout.js';
import { midiAt } from './keyboardLayers.js';

export type KeyboardInputOptions = {
  canvas: HTMLCanvasElement;
  layout: Layout;
  onKeyDown: (midi: number) => void;
  onKeyUp: (midi: number) => void;
  /** hover feedback, called with the key under the pointer or null */
  onHover?: (midi: number | null) => void;
};

export default class KeyboardInput {
  private readonly canvas: HTMLCanvasElement;
  private readonly layout: Layout;
  private readonly options: KeyboardInputOptions;
  /** pointerId -> midi it is currently holding */
  private readonly held = new Map<number, number>();

  constructor(options: KeyboardInputOptions) {
    this.canvas = options.canvas;
    this.layout = options.layout;
    this.options = options;

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerUp);
  }

  /** number of pointers currently holding a key */
  public get heldCount(): number {
    return this.held.size;
  }

  /** the keys each live pointer is holding */
  public get heldMidis(): number[] {
    return [...this.held.values()];
  }

  public dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerUp);

    for (const midi of this.held.values()) {
      this.options.onKeyUp(midi);
    }
    this.held.clear();
  }

  private localPoint(event: PointerEvent | MouseEvent): { x: number; y: number } {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  private isInsidePiano(y: number): boolean {
    return y >= this.layout.getPianoY() && y <= this.layout.getHeight();
  }

  private onPointerDown = (event: PointerEvent) => {
    const { x, y } = this.localPoint(event);
    if (!this.isInsidePiano(y)) {
      return;
    }

    // stop iOS from starting a text selection or showing the loupe
    event.preventDefault();
    this.canvas.setPointerCapture?.(event.pointerId);

    const midi = midiAt(this.layout, x, y);
    if (midi === null) {
      return;
    }

    this.held.set(event.pointerId, midi);
    this.options.onKeyDown(midi);
  };

  private onPointerMove = (event: PointerEvent) => {
    const { x, y } = this.localPoint(event);
    const pointerId = event.pointerId;

    if (!this.held.has(pointerId)) {
      this.options.onHover?.(
        this.isInsidePiano(y) ? midiAt(this.layout, x, y) : null,
      );
      return;
    }

    // dragged off the keyboard entirely: let go of that pointer's note
    if (!this.isInsidePiano(y)) {
      this.release(pointerId);
      return;
    }

    const midi = midiAt(this.layout, x, y);
    const current = this.held.get(pointerId);
    if (midi === null || midi === current) {
      return;
    }

    this.release(pointerId);
    this.held.set(pointerId, midi);
    this.options.onKeyDown(midi);
  };

  private onPointerUp = (event: PointerEvent) => {
    this.release(event.pointerId);
  };

  private release(pointerId: number): void {
    const midi = this.held.get(pointerId);
    if (midi === undefined) {
      return;
    }
    this.held.delete(pointerId);
    this.options.onKeyUp(midi);
  }
}
