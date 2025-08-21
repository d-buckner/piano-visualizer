import debounce from '../lib/debounce';
import Layout, { Section } from '../Layout';
import Cursor, { CursorType } from '../lib/Cursor';

type VisualizationControllerOptions = {
  canvas: HTMLCanvasElement;
  layout: Layout;
  onContainerTargetXChange: (x: number) => void;
  onContainerXChange: (x: number) => void;
  onWidthFactorChange: (widthFactor: number) => void;
  onWidthFactorTargetChange: (widthFactor: number) => void;
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

type TouchGestureType = 'pan' | 'pinch' | 'none';

type PinchContext = {
  initialDistance: number;
  initialCenter: { x: number; y: number };
  initialWidthFactor: number;
};

type MouseContext = ActiveMouseContext | InactiveMouseContext;

export default class VisualizationController {
  private options: VisualizationControllerOptions;
  private mouseContext: MouseContext;
  private touchContext: TouchStartContext = {};
  private pinchContext: PinchContext | null = null;
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
      gesturestart: this.onGestureStart,
      gesturechange: this.onGestureChange,
      gestureend: this.onGestureEnd,
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
    const gestureType = this.detectTouchGesture(e);

    for (const touch of e.touches) {
      const section = layout.getSection(touch.clientY);
      if (section === Section.PIANO) {
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

    if (gestureType === 'pinch' && e.touches.length === 2) {
      this.pinchContext = {
        initialDistance: this.calculatePinchDistance(e.touches),
        initialCenter: this.calculatePinchCenter(e.touches),
        initialWidthFactor: layout.getWidthFactor(),
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
      this.pinchContext = null;
    }

    if (touchIds.size < 2) {
      this.pinchContext = null;
    }

    Object.keys(this.touchContext).forEach((touchId) => {
      if (!touchIds.has(touchId)) {
        delete this.touchContext[touchId];
      }
    });
  }

  private onTouchMove(e: TouchEvent) {
    e.preventDefault();
    
    if (e.touches.length === 2 && this.pinchContext) {
      this.handlePinchMove(e);
      return;
    }
    
    if (e.changedTouches.length >= 1) {
      this.handlePanMove(e);
    }
  }

  private handlePinchMove(e: TouchEvent) {
    if (!this.pinchContext) return;

    const { layout, onContainerXChange, onContainerTargetXChange, 
            onWidthFactorChange } = this.options;

    const currentDistance = this.calculatePinchDistance(e.touches);
    const currentCenter = this.calculatePinchCenter(e.touches);
    
    const distanceRatio = currentDistance / this.pinchContext.initialDistance;
    const newWidthFactor = layout.getClampedWidthFactor(
      this.pinchContext.initialWidthFactor * distanceRatio
    );

    layout.setWidthFactor(newWidthFactor);
    onWidthFactorChange(newWidthFactor);

    const centerDeltaX = currentCenter.x - this.pinchContext.initialCenter.x;
    if (Math.abs(centerDeltaX) > 5) {
      const newX = layout.getClampedX(layout.getX() + centerDeltaX, true);
      onContainerXChange(newX);
      onContainerTargetXChange(newX);
      
      this.pinchContext.initialCenter = currentCenter;
    }
  }

  private handlePanMove(e: TouchEvent) {
    const touch = e.changedTouches[0];
    const touchEntry = this.touchContext[touch.identifier];
    if (!touchEntry) return;

    this.updatePointerX(
      touchEntry.clientX,
      touch.clientX,
      touchEntry.containerX,
    );
  }

  private onGestureStart(e: any) {
    e.preventDefault();
    const { layout } = this.options;
    this.pinchContext = {
      initialDistance: 1,
      initialCenter: { x: e.clientX || 0, y: e.clientY || 0 },
      initialWidthFactor: layout.getWidthFactor(),
    };
  }

  private onGestureChange(e: any) {
    if (!this.pinchContext) return;
    e.preventDefault();

    const { layout, onWidthFactorChange } = this.options;
    const scale = e.scale || 1;
    const newWidthFactor = layout.getClampedWidthFactor(
      this.pinchContext.initialWidthFactor * scale
    );

    layout.setWidthFactor(newWidthFactor);
    onWidthFactorChange(newWidthFactor);
  }

  private onGestureEnd(e: any) {
    e.preventDefault();
    this.completeGesture();
    this.pinchContext = null;
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    
    const { layout, onContainerXChange, onContainerTargetXChange, 
            onWidthFactorChange, onWidthFactorTargetChange } = this.options;
    
    if (e.deltaX !== 0) {
      const x = layout.getClampedX(layout.getX() - e.deltaX, true);
      onContainerXChange(x);
      onContainerTargetXChange(x);
    }
    
    if (e.deltaY !== 0) {
      const section = layout.getSection(e.clientY);
      if (section === Section.PIANO_ROLL) {
        const widthFactorDelta = e.deltaY * 0.001;
        const currentWidthFactor = layout.getWidthFactor();
        const newWidthFactor = layout.getClampedWidthFactor(currentWidthFactor - widthFactorDelta);
        
        layout.setWidthFactor(newWidthFactor);
        
        const newX = layout.getX();
        onContainerXChange(newX);
        onContainerTargetXChange(newX);
        
        onWidthFactorChange(newWidthFactor);
        onWidthFactorTargetChange(newWidthFactor);
      }
    }
    
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
    const x = layout.getClampedX(initialContainerX + deltaX, true);
    onContainerXChange(x);
    onContainerTargetXChange(x);
  }

  private onMouseLeave() {
    this.resetMouseContext();
  }

  private completeGesture(finalPosition?: number): void {
    const { layout, onContainerTargetXChange, onWidthFactorTargetChange } = this.options;
    
    const currentWidthFactor = layout.getWidthFactor();
    const quantizedWidthFactor = layout.getQuantizedWidthFactor(currentWidthFactor);
    if (quantizedWidthFactor !== currentWidthFactor) {
      layout.setWidthFactor(quantizedWidthFactor);
    }
    
    const currentX = finalPosition ?? layout.getX();
    const quantizedX = layout.getQuantizedX(currentX);
    
    onContainerTargetXChange(quantizedX);
    onWidthFactorTargetChange(quantizedWidthFactor);
  }

  private resetMouseContext() {
    this.mouseContext = {
      isDown: false,
    };
    this.completeGesture();
  }

  private detectTouchGesture(e: TouchEvent): TouchGestureType {
    const touchCount = e.touches.length;
    if (touchCount === 1) return 'pan';
    if (touchCount === 2) return 'pinch';
    return 'none';
  }

  private calculatePinchDistance(touches: TouchList): number {
    if (touches.length < 2) return 0;
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  private calculatePinchCenter(touches: TouchList): { x: number; y: number } {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }
}
