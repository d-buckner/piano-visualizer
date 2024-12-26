const MIN_HEIGHT = 100;
const MAX_HEIGHT_RATIO = 0.5; // can fill up to 50% of vertical space
const BAR_HEIGHT = 32;

type Config = {
    container: HTMLElement,
    onResize: (height: number) => void;
    initHeight: number,
}

export default function renderVerticalResizer(config: Config) {
    const {container, onResize, initHeight} = config;
    let isActive = false;

    const touchArea = document.createElement('div');
    // set initial style
    touchArea.style.position = 'absolute';
    touchArea.style.width = '100%';
    touchArea.style.height = `${BAR_HEIGHT}px`;
    touchArea.style.cursor = 'ns-resize';
    touchArea.style.display = 'flex';
    touchArea.style.justifyContent = 'center';

    setHeight(initHeight);

    const downHandler = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        isActive = true;
        document.body.style.cursor = 'ns-resize';
    };

    const upHandler = () => {
        isActive = false;
        document.body.style.cursor = '';
    };

    const moveHandler = (e: MouseEvent | TouchEvent) => {
        const {clientHeight} = container;
        let clientY;
        if (e instanceof TouchEvent) {
            const touch = e.changedTouches?.[0];
            clientY = touch.clientY;
        } else {
            clientY = e.clientY;
        }
        const height = clientHeight - clientY;
        if (!isActive || height < MIN_HEIGHT || height > clientHeight * MAX_HEIGHT_RATIO) {
            return;
        }

        setHeight(height);
        onResize(height);
    }

    // setup all handlers
    touchArea.onmousedown = downHandler;
    touchArea.ontouchstart = downHandler;
    container.onmouseup = upHandler;
    container.ontouchend = upHandler;
    container.onmousemove = moveHandler;
    container.ontouchmove = moveHandler;


    createUI();
    container.appendChild(touchArea);

    function setHeight(height: number) {
        const bottom = height - BAR_HEIGHT / 2;
        touchArea.style.bottom = `${bottom}px`;
    }

    function createUI() {
        const ui = document.createElement('div');
        ui.style.backgroundColor = '#424242';
        ui.style.border = '1px solid black';
        ui.style.width = '100%';
        ui.style.height = '8px';
        ui.style.alignSelf = 'center';
        touchArea.appendChild(ui);
    }

    return {
        dispose: () => {
            container.removeChild(touchArea);
        }
    };
}