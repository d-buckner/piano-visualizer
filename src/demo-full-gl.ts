/**
 * prototype demo: the full visualizer drawn by the WebGL2 QuadRenderer instead
 * of pixi. open /full-gl.html and compare against /index.html.
 */
import GLVisualization from './gl/GLVisualization';

const params = new URLSearchParams(window.location.search);

const ALL_LAYERS = ['backdrop', 'particles', 'roll', 'keyboard', 'fade'];
const layersParam = params.get('layers');
const layers = layersParam
  ? Object.fromEntries(
      ALL_LAYERS.map((name) => [name, layersParam.split(',').includes(name)]),
    )
  : undefined;

const visualization = new GLVisualization({
  container: document.body,
  backgroundColor: '#020410',
  layers,
});

if (params.get('stress') === '1') {
  visualization.setRange(60, 52);

  const SUSTAINED = [
    { midi: 50, color: '#62d982' },
    { midi: 69, color: '#4d91ff' },
    { midi: 86, color: '#bd4ed8' },
  ];
  const SHORT = [
    { midi: 53, color: '#8ff0a4', delay: 980, duration: 520 },
    { midi: 57, color: '#79df8d', delay: 1220, duration: 460 },
    { midi: 72, color: '#61a4ff', delay: 1030, duration: 560 },
    { midi: 74, color: '#4f86dc', delay: 1280, duration: 500 },
    { midi: 90, color: '#ef7cff', delay: 980, duration: 600 },
    { midi: 92, color: '#e763f5', delay: 1240, duration: 520 },
  ];

  let cycle = 0;
  const run = () => {
    const tag = cycle++;
    for (const note of SUSTAINED) {
      const id = `s${tag}-${note.midi}`;
      visualization.startNote(note.midi, note.color, id);
      window.setTimeout(() => visualization.endNote(note.midi, id), 5200);
    }
    for (const note of SHORT) {
      const id = `x${tag}-${note.midi}`;
      window.setTimeout(() => {
        visualization.startNote(note.midi, note.color, id);
        window.setTimeout(() => visualization.endNote(note.midi, id), note.duration);
      }, note.delay);
    }
  };

  run();
  window.setInterval(run, 5200);
}

declare global {
  interface Window {
    __pianoVisualizerGL?: GLVisualization;
  }
}

window.__pianoVisualizerGL = visualization;
