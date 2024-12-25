import {Container, Graphics, Ticker} from 'pixi.js';
import Layout from './Layout';

type Config = {
    container: Container;
    layout: Layout,
}

type Block = {
    isActive: boolean,
    graphics: Graphics,
    y: number,
    height: number,
    midi: number,
    color: string,
}

const RADIUS = 2;

export default class Roll {
    config: Config;
    container: Container;
    blocks: Map<number, Block[]> = new Map();

    constructor(config: Config) {
        this.config = config;
        this.container = new Container();
        this.config.container.addChild(this.container);

        for (let i = 0; i < 100; i++) {
            const startTime = Math.random() * 30000;
            const midi = Math.floor(Math.random() * 30);
            setTimeout(() => this.startNote(midi, '#5dadec'), startTime);
            setTimeout(() => this.endNote(midi), Math.floor(Math.random() * 1000) + startTime);

        }
    }

    public startNote(midi: number, color: string) {
        const element = this.config.layout.getRollElement(midi);
        const graphics = new Graphics()
            .roundRect(element.x, 0, element.width, 0, RADIUS)
            .fill(color);

        const existingEntries = this.blocks.get(midi);
        if (!existingEntries) {
            this.blocks.set(midi, []);
        }
        this.blocks.get(midi)!.push({
            isActive: true,
            y: 0,
            height: 0,
            graphics,
            midi,
            color,
        });
        this.container.addChild(graphics);
    }

    public endNote(midi: number) {
        const blocks = this.blocks.get(midi);
        if (!blocks?.length) {
            return;
        }

        for (const block of blocks) {
            if (block.isActive) {
                block.isActive = false;
                return;
            }
        }
    }

    public render(delta: Ticker) {
        const distance = delta.deltaMS / 4;
        this.blocks.forEach(blocks => {
            blocks.forEach(block => {
                block.graphics.clear();
                const element = this.config.layout.getRollElement(block.midi);
                const pianoY = this.config.layout.getPianoY();
                block.y -= distance;

                if (block.isActive) {
                    block.height += distance;
                    block.graphics
                        .roundRect(element.x, block.y + pianoY, element.width, block.height, RADIUS)
                        .fill(block.color);
                    return;
                }

                if (block.y + block.height + pianoY <= 0) {
                    const blockIndex = blocks.findIndex(b => b === block);
                    // BUG: splicing while iterating occasionally causes a 1 frame gap in animation since
                    //      the indexes of the original array are no longer accurate
                    blocks.splice(blockIndex, 1);
                    block.graphics.destroy();
                    return;
                }

                block.graphics
                    .roundRect(element.x, block.y + pianoY, element.width, block.height, RADIUS)
                    .fill(block.color);
            });
        });
    }
}
