const MIN_HEIGHT = 100;
const MAX_HEIGHT_RATIO = 0.5; // can fill up to 50% of vertical space
const BAR_HEIGHT = 12;

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

    resizeBar.onmousedown = () => isActive = true;
    container.onmouseup = () => isActive = false;
    container.onmousemove = (e: MouseEvent) => {
        const {clientHeight} = container;
        const height = clientHeight - e.clientY;
        if (!isActive || height < MIN_HEIGHT || height > clientHeight * MAX_HEIGHT_RATIO) {
            return;
        }

        setStyle(height);
        onResize(height);
    }

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