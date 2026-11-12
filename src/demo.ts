/**
 * demo: the full visualizer - keyboard, piano roll, atmosphere. open /.
 *
 * `?stress=1` drives a busy note schedule, `?layers=backdrop,keyboard` isolates
 * individual layers, and `?scenario=mock-2` replays the fixed sequence the
 * acceptance tests measure.
 */
import Visualization from './Visualization/index.js';

const params = new URLSearchParams(window.location.search);

const ALL_LAYERS = ['backdrop', 'particles', 'roll', 'keyboard', 'fade'];
const layersParam = params.get('layers');
const layers = layersParam
  ? Object.fromEntries(
      ALL_LAYERS.map((name) => [name, layersParam.split(',').includes(name)]),
    )
  : undefined;

const visualization = new Visualization({
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
    __pianoVisualizerDemo?: Visualization;
  }
}

window.__pianoVisualizerDemo = visualization;

/**
 * Fixed note schedule the acceptance tests measure against: three sustained
 * notes in three colours plus a burst of short ones, identical every run so
 * screenshots and frame timings are comparable.
 */
if (params.get('scenario') === 'mock-2') {
  visualization.setRange(60, 52);

  const isDesktop = window.innerWidth >= 900;
  const base = [
    { midi: 50, color: '#62d982', id: 'daniel-low', duration: 5200, delay: 0 },
    { midi: 69, color: '#4d91ff', id: 'maya-low', duration: 5200, delay: 0 },
    { midi: 86, color: '#bd4ed8', id: 'theo-high', duration: 5200, delay: 0 },
  ];
  const detail = isDesktop
    ? [
      { midi: 53, color: '#8ff0a4', id: 'daniel-mid', duration: 520, delay: 980 },
      { midi: 57, color: '#79df8d', id: 'daniel-high', duration: 460, delay: 1220 },
      { midi: 72, color: '#61a4ff', id: 'maya-mid', duration: 560, delay: 1030 },
      { midi: 74, color: '#4f86dc', id: 'maya-high', duration: 500, delay: 1280 },
      { midi: 90, color: '#ef7cff', id: 'theo-mid', duration: 600, delay: 980 },
      { midi: 92, color: '#e763f5', id: 'theo-low', duration: 520, delay: 1240 },
    ]
    : [
      { midi: 53, color: '#8ff0a4', id: 'daniel-mid', duration: 520, delay: 450 },
      { midi: 57, color: '#79df8d', id: 'daniel-high', duration: 460, delay: 750 },
      { midi: 72, color: '#61a4ff', id: 'maya-mid', duration: 560, delay: 550 },
      { midi: 74, color: '#4f86dc', id: 'maya-high', duration: 500, delay: 850 },
      { midi: 90, color: '#ef7cff', id: 'theo-mid', duration: 600, delay: 500 },
      { midi: 92, color: '#e763f5', id: 'theo-low', duration: 520, delay: 780 },
    ];

  for (const note of [...base, ...detail]) {
    window.setTimeout(() => visualization.startNote(note.midi, note.color, note.id), note.delay);
    window.setTimeout(
      () => visualization.endNote(note.midi, note.id),
      note.delay + note.duration,
    );
  }
}
