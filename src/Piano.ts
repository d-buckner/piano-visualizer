import {Application, ColorSource, Container, Graphics} from 'pixi.js';
import PianoLayout from './PianoLayout';
import Pitch from './Pitch';
import renderVerticalResizer from './verticalResizer';

type Config = {
    container: HTMLElement,
    background?: ColorSource,
}

const DEFAULT_HEIGHT = 250;

export default class Piano {
    private app: Application;
    private config: Config;
    private keyContainer: Container;
    private graphics: Graphics[];
    private layout: PianoLayout;
    private height: number;

    constructor(config: Config) {
        this.config = config;
        this.app = new Application();
        this.keyContainer = new Container();
        this.layout = new PianoLayout(config.container.clientWidth);
        this.app.stage.addChild(this.keyContainer);
        this.graphics = [];
        this.height = DEFAULT_HEIGHT;
        this.init();
    }

    public remove() {
        this.config.container.removeChild(this.app.canvas);
    }

    private async init() {
        const {container, background} = this.config;
        await this.app.init({
            background,
            resizeTo: container,
        });

        renderVerticalResizer({container, initHeight: this.height, onResize: height => {
            this.height = height;
        }});

        container.appendChild(this.app.canvas);
        container.appendChild
        this.app.ticker.add(() => {
            this.layout.setHeight(this.height);
            this.render();
            this.keyContainer.y = this.config.container.clientHeight - this.height;
        });
    }

    private render() {
        const prevKeyContainer = this.keyContainer;

        this.keyContainer = new Container();
        const naturalContainer = new Container();
        const accidentalContainer = new Container();

        // we have to clean up stale graphics instances to avoid a serious memory leak
        this.graphics.forEach(g => g.destroy());

        for (let midi = 0; midi < 88; midi++) {
            const pitch = new Pitch(midi);
            const keyGraphic = this.createKeyGraphic(pitch);
            this.graphics[midi] = keyGraphic;
            const targetContainer = pitch.isNatural ? naturalContainer : accidentalContainer;
            targetContainer.addChild(keyGraphic);
        }

        this.keyContainer.addChild(naturalContainer);
        this.keyContainer.addChild(accidentalContainer);
        this.app.stage.removeChild(prevKeyContainer);
        this.app.stage.addChild(this.keyContainer);
    }

    private createKeyGraphic(pitch: Pitch) {
        const keyElement = this.layout.getKeyElement(pitch.midi);
        const radius = 4;

        if (pitch.isNatural) {
            return new Graphics()
                .roundRect(keyElement.x, 0, keyElement.width, keyElement.height, radius)
                .fill('white')
                .stroke('black');
        }

        const shadowMargin = 4;
        return new Graphics()
            .roundRect(keyElement.x, 0, keyElement.width, keyElement.height, radius)
            .fill('black')
            .roundRect(
                keyElement.x + shadowMargin,
                0,
                keyElement.width - shadowMargin * 2,
                keyElement.height / 1.0625,
                radius * 1.5
            ).fill('#424242');
    }
}
