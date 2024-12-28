import debounce from './debounce';
import Layout from './Layout';

type VisualizationControllerOptions = {
    canvas: HTMLCanvasElement,
    layout: Layout,
    onContainerTargetXChange: (x: number) => void,
    onContainerXChange: (x: number) => void,
};

type ActiveMouseContext = {
    isDown: true,
    initialClientX: number,
    initialContainerX: number,
};

type InactiveMouseContext = {
    isDown: false,
    initialClientX: null,
    initialContainerX: null,
}

type TouchContext = {
    [touchId: string]: {
        initialClientX: number,
        initialContainerX: number,
    }
}

type MouseContext = ActiveMouseContext | InactiveMouseContext;

export default class VisualizationController {
    private options: VisualizationControllerOptions;
    private mouseContext: MouseContext;
    private touchContext: TouchContext = {};
    private targetContainerX: number = 0;

    constructor(options: VisualizationControllerOptions) {
        this.options = options;
        this.mouseContext = {
            isDown: false,
            initialClientX: null,
            initialContainerX: null,
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

        const ael = this.options.canvas.addEventListener;
        ael('mousedown', this.onMouseDown);
        ael('mouseup', this.onMouseUp);
        ael('mousemove', this.onMouseMove);
        ael('mouseleave', this.onMouseLeave);
        ael('touchstart', this.onTouchStart);
        ael('touchend', this.onTouchEnd);
        ael('touchmove', this.onTouchMove);
        ael('wheel', this.onWheel);
    }

    public dispose() {
        const {canvas} = this.options;
        const rel = canvas.removeEventListener;
        rel('mousedown', this.onMouseDown);
        rel('mouseup', this.onMouseUp);
        rel('mousemove', this.onMouseMove);
        rel('mouseleave', this.onMouseLeave);
        rel('touchstart', this.onTouchStart);
        rel('touchend', this.onTouchEnd);
        rel('touchmove', this.onTouchMove);
        rel('wheel', this.onWheel);
    }

    private onMouseDown(e: MouseEvent) {
        const {layout} = this.options;
        if (e.clientY < layout.getPianoY()) {
            this.mouseContext.isDown = true;
            this.mouseContext.initialClientX = e.clientX;
            this.mouseContext.initialContainerX = layout.getX();
        }
    }

    private onMouseUp() {
        this.resetMouseContext();
    }

    private onMouseMove(e: MouseEvent) {
        if (!this.mouseContext.isDown) {
            const {layout} = this.options;
            if (e.clientY < layout.getPianoY()) {
                document.body.style.cursor = 'grab';
            }
            return;
        }
        document.body.style.cursor = 'grabbing';

        this.updatePointerX(this.mouseContext.initialClientX, e.clientX, this.mouseContext.initialContainerX);
    }

    private onTouchStart(e: TouchEvent) {
        const {layout} = this.options;
        for (const touch of e.touches) {
            if (touch.clientY >= layout.getPianoY()) {
                return;
            }

            this.touchContext[touch.identifier] = {
                initialClientX: touch.clientX,
                initialContainerX: layout.getX(),
            }
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

        Object.keys(this.touchContext).forEach(touchId => {
            if (!touchIds.has(touchId)) {
                delete this.touchContext[touchId];
            }
        });
    }

    private onTouchMove(e: TouchEvent) {
        const touch = e.changedTouches[0];
        const touchEntry = this.touchContext[touch.identifier];
        if (touchEntry) {
            this.updatePointerX(touchEntry.initialClientX, touch.clientX, touchEntry.initialContainerX);
        }
    }

    private onWheel(e: WheelEvent) {
        const {
            layout,
            onContainerXChange,
            onContainerTargetXChange,
        } = this.options;
        const x = layout.getX() - e.deltaX;
        onContainerXChange(x);
        onContainerTargetXChange(x);
        this.onWheelSettled();
    }

    private onWheelSettled() {
        const {layout, onContainerTargetXChange} = this.options;
        this.targetContainerX = layout.getQuantizedX(layout.getX());
        onContainerTargetXChange(this.targetContainerX);
    }

    private updatePointerX(
        initialClientX: number,
        currentClientX: number,
        initialContainerX: number
    ) {
        const {layout, onContainerXChange, onContainerTargetXChange} = this.options;
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
        this.mouseContext.isDown = false;
        this.mouseContext.initialClientX = null;
        this.mouseContext.initialContainerX = null;
        this.options.onContainerTargetXChange(this.targetContainerX);
    }
}
