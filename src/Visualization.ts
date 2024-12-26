import {Application, ColorSource, Container} from 'pixi.js';
import Layout from './Layout';
import Piano from './Piano';
import Roll from './Roll';
import renderVerticalResizer, {VerticalResizer} from './verticalResizer';

const DEFAULT_COLOR = '#5dadec';

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
    private verticalResizer: VerticalResizer;
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
            onKeyDown: midi => this.startNote(midi, DEFAULT_COLOR),
            onKeyUp: midi => this.endNote(midi),
        });
        this.roll = new Roll({
            container: this.container,
            layout: this.layout,
        });
        this.verticalResizer = renderVerticalResizer({
            container: config.container,
            initHeight: this.layout.getPianoHeight(),
            onResize: pianoHeight => this.layout.updatePianoHeight(pianoHeight),
        });

        this.app.stage.addChild(this.container);
        this.init();

        this.resizeObserver = new ResizeObserver(([entry]) => {
            this.layout.setWidth(entry.contentRect.width);
        });
        this.resizeObserver.observe(config.container);
    }

    public startNote(midi: number, color: string, identifier?: string) {
        this.roll.startNote(midi, color, identifier);
        this.piano.keyDown(midi, color, identifier);
    }

    public endNote(midi: number, identifier?: string) {
        this.roll.endNote(midi, identifier);
        this.piano.keyUp(midi, identifier);
    }

    public destroy() {
        this.verticalResizer.dispose();
        this.resizeObserver.disconnect();
        this.app.destroy();
    }

    private async init() {
        const {container, backgroundColor} = this.config;
        await this.app.init({
            background: backgroundColor,
            resizeTo: container,
            preference: 'webgpu',
        });

        container.appendChild(this.app.canvas);

        this.app.ticker.add(delta => {
            this.piano.render();
            this.roll.render(delta);
        });
    }
}
