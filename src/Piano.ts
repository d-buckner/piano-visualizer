import {ColorSource, Container, Graphics} from 'pixi.js';
import Layout from './Layout';
import Pitch from './Pitch';

type Config = {
    container: Container;
    backgroundColor?: ColorSource;
    layout: Layout;
}


export default class Piano {
    private config: Config;
    private container: Container;
    private graphics: Graphics[];
    private layout: Layout;

    constructor(config: Config) {
        this.config = config;
        this.container = new Container();
        this.layout = config.layout;
        this.graphics = Array.from({length: 89}, () => new Graphics());
        this.render();
    }

    public render() {
        const prevKeyContainer = this.container;

        this.container = new Container();
        const naturalContainer = new Container();
        const accidentalContainer = new Container();

        for (let midi = 0; midi < 88; midi++) {
            const pitch = new Pitch(midi);
            const keyGraphic = this.createKeyGraphic(pitch);
            this.graphics[midi] = keyGraphic;
            const targetContainer = pitch.isNatural ? naturalContainer : accidentalContainer;
            targetContainer.addChild(keyGraphic);
        }

        this.container.addChild(naturalContainer);
        this.container.addChild(accidentalContainer);
        this.config.container.removeChild(prevKeyContainer);
        this.config.container.addChild(this.container);
        this.container.y = this.layout.getPianoY();
    }

    private createKeyGraphic(pitch: Pitch) {
        const keyElement = this.layout.getKeyElement(pitch.midi);
        const radius = 4;
        const graphic = this.graphics[pitch.midi];
        graphic.clear();

        if (pitch.isNatural) {
            return graphic
                .roundRect(keyElement.x, 0, keyElement.width, keyElement.height, radius)
                .fill('white')
                .stroke('black');
        }

        const shadowMargin = 4;
        return graphic
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
