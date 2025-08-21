/**
 * input controller - handles mouse and touch events for the piano keys.
 * tries to support multi-touch and mouse dragging across keys.
 * includes some edge case handling for when the cursor leaves the piano area.
 */
import { type FederatedPointerEvent, Graphics } from 'pixi.js';
import Cursor, { CursorType } from '../lib/Cursor';
import type Layout from '../Layout';


type Options = {
  graphics: Graphics[];
  onKeyDown: (midi: number) => void;
  onKeyUp: (midi: number) => void;
  layout: Layout;
};

type FPE = FederatedPointerEvent;

export default class PianoController {
  private options: Options;
  private layout: Layout;
  private isMouseDown = false;
  private mouseMidi: number | null = null;
  private touchMidiById: Map<number, number> = new Map();

  constructor(options: Options) {
    this.options = options;
    this.layout = options.layout;
    this.options.graphics.forEach(this.addKeyHandlers.bind(this));
    const globalEventTarget = this.options.graphics[0];

    globalEventTarget.on('globalmousemove', (e: FPE) => {
      if (this.mouseMidi === null) {
        if (e.clientY > this.layout.getPianoY()) {
          Cursor.set(CursorType.POINTER);
        }
        return;
      }

      if (this.isEventOutsidePiano(e)) {
        this.options.onKeyUp(this.mouseMidi);
        this.mouseMidi = null;
        this.isMouseDown = false;
      }
    });

    globalEventTarget.on('globaltouchmove', (e: FPE) => {
      const { pointerId } = e;
      const midi = this.touchMidiById.get(pointerId);
      if (midi === undefined) {
        return;
      }

      if (this.isEventOutsidePiano(e)) {
        this.handleTouchEnd(pointerId);
      }
    });

    // Handle global touch end/cancel to prevent stuck keys
    globalEventTarget.on('globaltouchend', (e: FPE) => {
      this.handleTouchEnd(e.pointerId);
    });

    globalEventTarget.on('globaltouchcancel', (e: FPE) => {
      this.handleTouchEnd(e.pointerId);
    });
  }

  private isEventOutsidePiano(e: FPE) {
    return e.clientY > this.layout.getHeight() // below piano
      || e.clientY < this.layout.getPianoY()   // above piano
      || e.clientX < 0                         // left of piano
      || e.clientX > this.layout.getWidth();   // right of piano
  }

  private handleTouchEnd(pointerId: number) {
    const pointerMidi = this.touchMidiById.get(pointerId);
    this.touchMidiById.delete(pointerId);
    if (pointerMidi !== undefined) {
      this.options.onKeyUp(pointerMidi);
    }
  }

  private addKeyHandlers(graphic: Graphics, key: number) {
    const midi = key + 21;
    graphic.eventMode = 'static';
    graphic.on('mousedown', () => {
      this.options.onKeyDown(midi);
      this.isMouseDown = true;
      this.mouseMidi = midi;
    });

    graphic.on('mouseup', () => {
      this.isMouseDown = false;
      if (this.mouseMidi === null) {
        return;
      }

      this.options.onKeyUp(this.mouseMidi);
      this.mouseMidi = null;
    });

    graphic.on('mouseenter', () => {
      if (!this.isMouseDown || this.mouseMidi === midi) {
        return;
      }

      if (this.mouseMidi !== null) {
        this.options.onKeyUp(this.mouseMidi);
      }

      this.options.onKeyDown(midi);
      this.mouseMidi = midi;
    });

    graphic.on('touchstart', (e: FPE) => {
      e.preventDefault();
      this.touchMidiById.set(e.pointerId, midi);
      this.options.onKeyDown(midi);
    });

    graphic.on('touchmove', (e: FPE) => {
      const prevMidi = this.touchMidiById.get(e.pointerId);
      if (prevMidi === midi) {
        return;
      }
      
      e.preventDefault();
      if (prevMidi !== undefined) {
        this.options.onKeyUp(prevMidi);
      }

      this.options.onKeyDown(midi);
      this.touchMidiById.set(e.pointerId, midi);
    });

    graphic.on('touchend', (e: FPE) => {
      e.preventDefault();
      this.handleTouchEnd(e.pointerId);
    });

    graphic.on('touchcancel', (e: FPE) => {
      e.preventDefault();
      this.handleTouchEnd(e.pointerId);
    });
  }
}
