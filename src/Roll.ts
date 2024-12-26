import {Container, Graphics, Ticker} from 'pixi.js';
import Layout from './Layout';

const BORDER_COLOR = '#2d2e2e';

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
    identifier?: string,
}

type GraphicsOptions = {
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    graphics?: Graphics,
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
    }

    public startNote(midi: number, color: string, identifier?: string) {
        const element = this.config.layout.getRollElement(midi);
        const graphics = this.updateGraphics({
            x: element.x,
            y: 0,
            width: element.width,
            height: 0,
            color,
        });

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
            identifier,
        });
        this.container.addChild(graphics);
    }

    public endNote(midi: number, identifier?: string) {
        const blocks = this.blocks.get(midi);
        if (!blocks?.length) {
            return;
        }

        if (identifier) {
            for (const block of blocks) {
                if (identifier === block.identifier) {
                    block.isActive = false;
                }
            }
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
        const distance = delta.deltaMS / 3;
        this.blocks.forEach(blocks => {
            const indexesToRemove: number[] = [];
            blocks.forEach(block => {
                block.graphics.clear();
                const element = this.config.layout.getRollElement(block.midi);
                const pianoY = this.config.layout.getPianoY();
                block.y -= distance;

                if (block.isActive) {
                    block.height += distance;
                    this.updateGraphics({
                        x: element.x,
                        y: block.y + pianoY,
                        width: element.width,
                        height: block.height,
                        color: block.color,
                        graphics: block.graphics,
                    });
                    return;
                }

                if (block.y + block.height + pianoY <= 0) {
                    const blockIndex = blocks.findIndex(b => b === block);
                    indexesToRemove.push(blockIndex);
                    return;
                }

                this.updateGraphics({
                    x: element.x,
                    y: block.y + pianoY,
                    width: element.width,
                    height: block.height,
                    color: block.color,
                    graphics: block.graphics
                });
            });

            indexesToRemove.forEach(blockIndex => {
                const block = blocks[blockIndex];
                if (!block) {
                    return;
                }
                block.graphics.destroy();
                if (blocks.length === 1) {
                    this.blocks.delete(block.midi);
                    return;
                }
                blocks.splice(blockIndex, 1);
            });
        });
    }

    private updateGraphics(options: GraphicsOptions) {
        const {graphics, x, y, width, height, color} = options;
        const g = graphics ?? new Graphics();
        g
            .roundRect(x, y, width, height, RADIUS)
            .fill(color)
            .stroke({
                width: 2,
                color: BORDER_COLOR,
            });

        return g;
    }
}
