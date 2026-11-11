/**
 * demo: the keyboard on its own, in the shape p2piano sheet-music mode needs it.
 *
 * a score area above, a compact live input strip below. no piano roll, no
 * falling notes, no ambient particles — nothing is constructed that is not on
 * screen. run it with `npm run dev` and open /keyboard.html.
 */
import Piano from './keyboard';

const COLORS = ['#4d91ff', '#62d982', '#bd4ed8', '#f2c14e'];

const layout = document.createElement('div');
layout.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;background:#0b0d12;';

const score = document.createElement('div');
score.style.cssText = `
  flex:1; display:grid; place-items:center; color:#5b6472;
  font:14px/1.6 ui-sans-serif,system-ui,sans-serif; text-align:center; padding:24px;
`;
score.innerHTML = `
  <div>
    <div style="letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#3f4753">
      sheet music mode
    </div>
    <div style="margin-top:10px">
      the strip below is the whole package: <code>piano-visualizer/keyboard</code>
    </div>
    <div id="readout" style="margin-top:14px;color:#8b93a1;min-height:1.6em">&nbsp;</div>
  </div>
`;

const strip = document.createElement('div');
strip.style.cssText = 'height:220px;flex:none;position:relative;';

layout.append(score, strip);
document.body.append(layout);

const readout = score.querySelector('#readout') as HTMLElement | null;
let pressed = 0;

// `?stress=1` renders all 88 keys with a rotating cluster held down, which is
// what scripts/compare-backends.mjs measures against the GL prototype.
const stress = new URLSearchParams(window.location.search).get('stress') === '1';

const keyboard = new Piano({
  container: strip,
  backgroundColor: '#101318',
  range: { centerMidi: 60, visibleKeys: stress ? 52 : 14 },
  onKeyDown: (midi) => {
    const color = COLORS[pressed % COLORS.length] as string;
    pressed += 1;
    keyboard.keyDown(midi, color);
    if (readout) {
      readout.textContent = `key ${midi} pressed (pointer input is owned by the keyboard)`;
    }
  },
  onKeyUp: (midi) => {
    keyboard.keyUp(midi);
    if (readout) {
      readout.textContent = `key ${midi} released`;
    }
  },
});

// a small figure so the strip is visibly alive without any input
const FIGURE = [60, 64, 67, 71, 72, 71, 67, 64];
let step = 0;

window.setInterval(() => {
  const midi = FIGURE[step % FIGURE.length] as number;
  step += 1;

  const color = COLORS[Math.floor(step / FIGURE.length) % COLORS.length] as string;
  keyboard.keyDown(midi, color);
  window.setTimeout(() => keyboard.keyUp(midi), 260);
}, 420);

if (stress) {
  let held: number[] = [];

  window.setInterval(() => {
    held.forEach((midi) => keyboard.keyUp(midi));
    held = [];

    for (let index = 0; index < 24; index++) {
      const midi = 21 + ((index * 7 + Math.floor(Date.now() / 120)) % 88);
      keyboard.keyDown(midi, COLORS[index % COLORS.length] as string);
      held.push(midi);
    }
  }, 100);
}

declare global {
  interface Window {
    __pianoVisualizerKeyboard?: Piano;
  }
}

window.__pianoVisualizerKeyboard = keyboard;
