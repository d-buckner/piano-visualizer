import {Container, Graphics} from 'pixi.js';
import Layout from './Layout';

type Config = {
    container: Container;
    layout: Layout,
}

export default class Roll {
    config: Config;
    container: Container;
    blocks: Graphics[] = [];

    constructor(config: Config) {
        this.config = config;
        this.container = new Container();
        this.config.container.addChild(this.container);
    }

    public render() {
        this.blocks.forEach(b => b.destroy());

        this.blocks[0] = this.createBlock(7, 500);
        this.blocks[1] = this.createBlock(1, 350);
        this.blocks.forEach(b => this.container.addChild(b));
    }

    private createBlock(midi: number, y: number) {
        const element = this.config.layout.getKeyElement(midi);
        const pianoY = this.config.layout.getPianoY();
        return new Graphics()
            .roundRect(element.x, pianoY - y, element.width, 200, 4)
            .fill('blue');
    }
}