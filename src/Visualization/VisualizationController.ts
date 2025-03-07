import debounce from '../lib/debounce';
import Layout, { Section } from '../Layout';
import setCursor, { Cursor } from '../lib/setCursor';

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
  private targetContainerX: number = 0;
  private eventListeners: Record<string, Function>;

  constructor(options: VisualizationControllerOptions) {
    this.options = options;
    this.mouseContext = {
      isDown: false,
    };

    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onWheelSettled = debounce(this.onWheelSettled.bind(this), 50);

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

    Object.entries(this.eventListeners).forEach(([eventType, handler]) => {
      this.options.canvas.addEventListener(eventType, handler as EventListener);
    });
  }

  public dispose() {
    Object.entries(this.eventListeners).forEach(([eventType, handler]) => {
      this.options.canvas.removeEventListener(
        eventType,
        handler as EventListener,
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
        setCursor(Cursor.GRAB);
      }

      return;
    }


    setCursor(Cursor.GRABBING);

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
    const touchIds = new Set();
    for (const touch of e.touches) {
      touchIds.add(touch.identifier);
    }

    if (touchIds.size === 0) {
      this.options.onContainerTargetXChange(this.targetContainerX);
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


    this.updatePointerX(
      touchEntry.clientX,
      touch.clientX,
      touchEntry.containerX,
    );
  }

  private onWheel(e: WheelEvent) {
    const { layout, onContainerXChange, onContainerTargetXChange } =
      this.options;
    const x = layout.getX() - e.deltaX;
    onContainerXChange(x);
    onContainerTargetXChange(x);
    this.onWheelSettled();
  }

  private onWheelSettled() {
    const { layout, onContainerTargetXChange } = this.options;
    this.targetContainerX = layout.getQuantizedX(layout.getX());
    onContainerTargetXChange(this.targetContainerX);
  }

  private updatePointerX(
    initialClientX: number,
    currentClientX: number,
    initialContainerX: number,
  ) {
    const { layout, onContainerXChange, onContainerTargetXChange } =
      this.options;
    const deltaX = currentClientX - initialClientX;
    const rawTargetX = initialContainerX + deltaX;
    const x = Math.min(rawTargetX, 0);
    this.targetContainerX = layout.getQuantizedX(x);
    onContainerXChange(x);
    onContainerTargetXChange(x);
  }

  private onMouseLeave() {
    this.resetMouseContext();
  }

  private resetMouseContext() {
    this.mouseContext = {
      isDown: false,
    };
    this.options.onContainerTargetXChange(this.targetContainerX);
  }
}
