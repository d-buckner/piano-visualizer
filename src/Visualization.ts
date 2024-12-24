import {Application, ColorSource, Container} from 'pixi.js';
import Layout from './Layout';
import Piano from './Piano';
import Roll from './Roll';
import renderVerticalResizer from './verticalResizer';


type Config = {
    container: HTMLElement;
    backgroundColor?: ColorSource;
}


export default class Visualization {
    private app: Application;
    private config: Config;
    private piano: Piano;
    private roll: Roll;
    private layout: Layout;
    private container: Container;
    private resizeObserver: ResizeObserver;

    constructor(config: Config) {
        this.config = config;
        this.app = new Application();
        this.container = new Container();
        this.layout = new Layout({
            width: config.container.clientWidth,
            height: config.container.clientHeight,
            pianoHeight: 250,
        });

        this.piano = new Piano({
            container: this.container,
            layout: this.layout,
        });
        this.roll = new Roll({
            container: this.container,
            layout: this.layout,
        });

        this.app.stage.addChild(this.container);
        this.init();

        this.resizeObserver = new ResizeObserver(([entry]) => {
            this.layout.setWidth(entry.contentRect.width);
        });
        this.resizeObserver.observe(config.container);
    }

    public destroy() {
        this.resizeObserver.disconnect();
        this.app.destroy();
    }

    private async init() {
        const {container, backgroundColor} = this.config;
        await this.app.init({
            background: backgroundColor,
            resizeTo: container,
        });

        container.appendChild(this.app.canvas);
        renderVerticalResizer({
            container,
            initHeight: this.layout.getPianoHeight(),
            onResize: pianoHeight => this.layout.updatePianoHeight(pianoHeight),
        });

        this.app.ticker.add(() => {
            this.piano.render();
            this.roll.render();
        });
    }
}
