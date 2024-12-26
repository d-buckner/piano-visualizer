import {Application, ColorSource, Container} from 'pixi.js';
import Layout from './Layout';
import Piano from './Piano';
import Roll from './Roll';
import renderVerticalResizer from './verticalResizer';

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
        renderVerticalResizer({
            container,
            initHeight: this.layout.getPianoHeight(),
            onResize: pianoHeight => this.layout.updatePianoHeight(pianoHeight),
        });

        this.app.ticker.add(delta => {
            this.piano.render();
            this.roll.render(delta);
        });

        // for (let i = 0; i < 100; i++) {
        //     const color = '#5dadec';
        //     const startTime = Math.random() * 30000;
        //     const midi = Math.floor(Math.random() * 30);
        //     setTimeout(() => {
        //         this.startNote(midi, color);
        //     }, startTime);
        //     setTimeout(() => {
        //         this.endNote(midi);
        //     }, Math.floor(Math.random() * 1000) + startTime + 200);
        // }
    }
}
