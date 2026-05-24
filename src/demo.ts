import Visualization from './Visualization';

const visualization = new Visualization({
    container: document.body,
    backgroundColor: 'black',
});

const params = new URLSearchParams(window.location.search);

if (params.get('scenario') === 'mock-2') {
    visualization.setRange(60, 52);

    type WarmedBlock = {
        y: number;
        height: number;
        lastHeight?: number;
        needsRedraw?: boolean;
    };
    type WarmedVisualization = {
        pianoRoll: {
            blocks: Map<number, WarmedBlock[]>;
        };
    };
    const animationSpeedFactor = 0.2;
    const isDesktopScenario = window.innerWidth >= 900;
    const baseNotes = [
        { midi: 50, color: '#62d982', id: 'daniel-low', duration: 5200, delay: 0, warmup: 1200 },
        { midi: 69, color: '#4d91ff', id: 'maya-low', duration: 5200, delay: 0, warmup: 980 },
        { midi: 86, color: '#bd4ed8', id: 'theo-high', duration: 5200, delay: 0, warmup: 900 },
    ];
    const mobileDetailNotes = [
        { midi: 53, color: '#8ff0a4', id: 'daniel-mid', duration: 520, delay: 450, warmup: 240 },
        { midi: 57, color: '#79df8d', id: 'daniel-high', duration: 460, delay: 750, warmup: 120 },
        { midi: 72, color: '#61a4ff', id: 'maya-mid', duration: 560, delay: 550, warmup: 200 },
        { midi: 74, color: '#4f86dc', id: 'maya-high', duration: 500, delay: 850, warmup: 100 },
        { midi: 90, color: '#ef7cff', id: 'theo-mid', duration: 600, delay: 500, warmup: 220 },
        { midi: 92, color: '#e763f5', id: 'theo-low', duration: 520, delay: 780, warmup: 120 },
    ];
    const desktopDetailNotes = [
        { midi: 53, color: '#8ff0a4', id: 'daniel-mid', duration: 520, delay: 980, warmup: 220 },
        { midi: 57, color: '#79df8d', id: 'daniel-high', duration: 460, delay: 1220, warmup: 80 },
        { midi: 72, color: '#61a4ff', id: 'maya-mid', duration: 560, delay: 1030, warmup: 190 },
        { midi: 74, color: '#4f86dc', id: 'maya-high', duration: 500, delay: 1280, warmup: 70 },
        { midi: 90, color: '#ef7cff', id: 'theo-mid', duration: 600, delay: 980, warmup: 190 },
        { midi: 92, color: '#e763f5', id: 'theo-low', duration: 520, delay: 1240, warmup: 80 },
    ];
    const notes = [
        ...baseNotes,
        ...(isDesktopScenario ? desktopDetailNotes : mobileDetailNotes),
    ];

    const warmBlock = (midi: number, warmup: number) => {
        const blocks = (visualization as unknown as WarmedVisualization).pianoRoll.blocks.get(midi);
        const block = blocks?.[blocks.length - 1];
        if (!block || warmup <= 0) {
            return;
        }

        const distance = warmup * animationSpeedFactor;
        block.y = -distance;
        block.height = distance;
        block.lastHeight = undefined;
        block.needsRedraw = true;
    };

    for (const note of notes) {
        window.setTimeout(() => {
            visualization.startNote(note.midi, note.color, note.id);
            warmBlock(note.midi, note.warmup);
        }, note.delay);
        window.setTimeout(() => {
            visualization.endNote(note.midi, note.id);
        }, note.delay + note.duration);
    }
}

declare global {
    interface Window {
        __pianoVisualizerDemo?: Visualization;
    }
}

window.__pianoVisualizerDemo = visualization;
