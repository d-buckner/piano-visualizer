import debounce from '../lib/debounce';
import Layout, { Section } from '../Layout';
import Cursor, { CursorType } from '../lib/Cursor';

type VisualizationControllerOptions = {
  canvas: HTMLCanvasElement;
  layout: Layout;
  onContainerTargetXChange: (x: number) => void;
  onContainerXChange: (x: number) => void;
};

type MouseDownContext = {
  clientX: number;
  clientY: number;
  containerX: number;
  pianoHeight: number;
  section: Section;
};

type ActiveMouseContext = {
  isDown: true;
  init: MouseDownContext
};

type InactiveMouseContext = {
  isDown: false;
};

type TouchStartContext = {
  [touchId: string]: MouseDownContext;
};

type MouseContext = ActiveMouseContext | InactiveMouseContext;

export default class VisualizationController {
  private options: VisualizationControllerOptions;
  private mouseContext: MouseContext;
  private touchContext: TouchStartContext = {};
  private eventListeners: Record<string, Function>;
  private abortController: AbortController;
  private readonly passiveEventTypes = new Set<string>([]);

  constructor(options: VisualizationControllerOptions) {
    this.options = options;
    this.mouseContext = {
      isDown: false,
    };

    this.onWheelSettled = debounce(this.onWheelSettled.bind(this), 30);

    this.eventListeners = {
      mousedown: this.onMouseDown,
      mouseup: this.onMouseUp,
      mousemove: this.onMouseMove,
      mouseleave: this.onMouseLeave,
      touchstart: this.onTouchStart,
      touchend: this.onTouchEnd,
      touchmove: this.onTouchMove,
      wheel: this.onWheel,
    };

    this.abortController = new AbortController();
    this.initEventListeners();
  }

  public dispose() {
    this.abortController.abort();
  }

  private initEventListeners() {
    Object.entries(this.eventListeners).forEach(([eventType, handler]) => {
      this.options.canvas.addEventListener(
        eventType,
        handler.bind(this) as EventListener,
        { 
          signal: this.abortController.signal,
          passive: this.passiveEventTypes.has(eventType)
        }
      );
    });
  }

  private onMouseDown(e: MouseEvent) {
    const { layout } = this.options;
    const section = layout.getSection(e.clientY);
    if (section === Section.PIANO) {
      return;
    }

    this.mouseContext = {
      isDown: true,
      init: {
        clientX: e.clientX,
        clientY: e.clientY,
        containerX: layout.getX(),
        section: layout.getSection(e.clientY),
        pianoHeight: layout.getPianoHeight(),
      },
    };
  }

  private onMouseUp() {
    this.resetMouseContext();
  }

  private onMouseMove(e: MouseEvent) {
    const { layout } = this.options;
    if (!this.mouseContext.isDown) {
      const section = layout.getSection(e.clientY);
      if (section === Section.PIANO_ROLL) {
        Cursor.set(CursorType.GRAB);
      }

      return;
    }


    Cursor.set(CursorType.GRABBING);

    this.updatePointerX(
      this.mouseContext.init.clientX,
      e.clientX,
      this.mouseContext.init.containerX,
    );
  }

  private onTouchStart(e: TouchEvent) {
    const { layout } = this.options;
    for (const touch of e.touches) {
      const section = layout.getSection(touch.clientY);
      if (section === Section.PIANO) {
        // piano events are handled by PianoController
        // we ignore these so we don't step on it's toes
        return;
      }

      e.preventDefault();
      this.touchContext[touch.identifier] = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        containerX: layout.getX(),
        section: section,
        pianoHeight: layout.getPianoHeight(),
      };
    }
  }

  private onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    const touchIds = new Set();
    for (const touch of e.touches) {
      touchIds.add(touch.identifier);
    }

    if (touchIds.size === 0) {
      this.completeGesture();
    }

    Object.keys(this.touchContext).forEach((touchId) => {
      if (!touchIds.has(touchId)) {
        delete this.touchContext[touchId];
      }
    });
  }

  private onTouchMove(e: TouchEvent) {
    const touch = e.changedTouches[0];
    const touchEntry = this.touchContext[touch.identifier];
    if (!touchEntry) {
      return;
    }


    e.preventDefault();
    this.updatePointerX(
      touchEntry.clientX,
      touch.clientX,
      touchEntry.containerX,
    );
  }

  private onWheel(e: WheelEvent) {
    // Prevent browser navigation on horizontal swipe
    e.preventDefault();
    
    const { layout, onContainerXChange, onContainerTargetXChange } =
      this.options;
    const x = layout.getClampedX(layout.getX() - e.deltaX);
    onContainerXChange(x);
    onContainerTargetXChange(x);
    this.onWheelSettled();
  }

  private onWheelSettled() {
    this.completeGesture();
  }

  private updatePointerX(
    initialClientX: number,
    currentClientX: number,
    initialContainerX: number,
  ) {
    const { layout, onContainerXChange, onContainerTargetXChange } =
      this.options;
    const deltaX = currentClientX - initialClientX;
    const x = layout.getClampedX(initialContainerX + deltaX);
    onContainerXChange(x);
    onContainerTargetXChange(x);
  }

  private onMouseLeave() {
    this.resetMouseContext();
  }

  private completeGesture(finalPosition?: number): void {
    const { layout, onContainerTargetXChange } = this.options;
    const currentX = finalPosition ?? layout.getX();
    const quantizedX = layout.getQuantizedX(currentX);
    onContainerTargetXChange(quantizedX);
  }

  private resetMouseContext() {
    this.mouseContext = {
      isDown: false,
    };
    this.completeGesture();
  }
}
