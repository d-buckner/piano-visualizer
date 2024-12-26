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

    const resizeBar = document.createElement('div');
    setStyle(initHeight);

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

        setStyle(height);
        onResize(height);
    }

    resizeBar.onmousedown = downHandler;
    resizeBar.ontouchstart = downHandler;
    container.onmouseup = upHandler;
    container.ontouchend = upHandler;
    container.onmousemove = moveHandler;
    container.ontouchmove = moveHandler;

    container.appendChild(resizeBar);

    function setStyle(height: number) {
        const bottom = height - BAR_HEIGHT / 2;
        const styles: string[] = [
            'position: absolute',
            'width: 100%',
            `height: ${BAR_HEIGHT}px`,
            'cursor: ns-resize',
            `bottom: ${bottom}px;`,
        ];
        resizeBar.setAttribute('style', styles.join('; '));
    }

    return {
        dispose: () => {
            container.removeChild(resizeBar);
        }
    };
}