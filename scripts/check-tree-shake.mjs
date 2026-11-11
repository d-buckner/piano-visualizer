/**
 * tree-shaking gate.
 *
 * the whole point of shipping per-file ESM is that "just the keyboard" costs
 * what the keyboard costs. that claim is easy to make and easy to silently lose,
 * so it gets asserted against the real build output instead of trusted.
 *
 * run after `npm run build`.
 */
import { build } from 'esbuild';

const EXTERNAL = ['pixi.js', 'd-piano', 'tone'];

/**
 * each case: what a consumer imports, and which internal modules must NOT end
 * up in the bundle.
 */
const CASES = [
  {
    name: 'keyboard only (subpath)',
    code: `import Piano from 'piano-visualizer/keyboard'; export default Piano;`,
    forbidden: ['PianoRoll', 'BackgroundParticles', 'GestureAnimator', 'VisualizationController', 'PianoAudio', 'loadDPiano'],
  },
  {
    name: 'piano roll only (subpath)',
    code: `import PianoRoll from 'piano-visualizer/piano-roll'; export default PianoRoll;`,
    forbidden: ['PianoController', 'PianoTheme', 'BackgroundParticles', 'GestureAnimator', 'VisualizationController', 'PianoAudio', 'loadDPiano'],
  },
  {
    name: 'keyboard only (root barrel)',
    code: `import { Piano } from 'piano-visualizer'; export default Piano;`,
    forbidden: ['PianoRoll', 'BackgroundParticles', 'VisualizationController', 'loadDPiano'],
  },
  {
    name: 'audio only',
    code: `import PianoAudio from 'piano-visualizer/audio'; export default PianoAudio;`,
    forbidden: ['PianoRoll', 'Piano/Piano', 'Visualization', 'BackgroundParticles'],
  },
  {
    name: 'core only',
    code: `import { Layout } from 'piano-visualizer/core'; export default Layout;`,
    forbidden: ['PianoRoll', 'Piano/Piano', 'Visualization', 'loadDPiano'],
  },
  {
    name: 'full composition',
    code: `import Visualization from 'piano-visualizer'; export default Visualization;`,
    forbidden: ['loadDPiano'],
    required: ['PianoRoll', 'Piano/Piano', 'BackgroundParticles'],
  },
];

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)}kb`;

let failed = false;

for (const testCase of CASES) {
  const result = await build({
    stdin: {
      contents: testCase.code,
      resolveDir: process.cwd(),
      loader: 'js',
      // resolve 'piano-visualizer/*' to this working copy, not an installed one
    },
    bundle: true,
    write: false,
    format: 'esm',
    metafile: true,
    external: EXTERNAL,
    logLevel: 'silent',
    alias: {
      'piano-visualizer': new URL('../dist', import.meta.url).pathname,
    },
  });

  const [, output] = Object.entries(result.metafile.outputs)[0];
  const inputs = Object.entries(output.inputs)
    .filter(([path]) => !path.includes('node_modules'))
    .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput);
  const joined = inputs.map(([path]) => path).join(' ');

  const violations = (testCase.forbidden ?? [])
    .filter((needle) => joined.includes(needle));
  const missing = (testCase.required ?? [])
    .filter((needle) => !joined.includes(needle));

  const ok = violations.length === 0 && missing.length === 0;
  if (!ok) {
    failed = true;
  }

  console.log(`${ok ? 'PASS' : 'FAIL'}  ${testCase.name} — ${formatBytes(output.bytes)} of package code`);
  for (const violation of violations) {
    console.log(`      pulled in ${violation}, which it should not`);
  }
  for (const miss of missing) {
    console.log(`      missing ${miss}, which it should include`);
  }

  if (process.env.VERBOSE) {
    for (const [path, { bytesInOutput }] of inputs) {
      console.log(`      ${formatBytes(bytesInOutput).padStart(8)}  ${path.replace(/^dist\//, '')}`);
    }
  }
}

if (failed) {
  console.error('\ntree shaking regressed');
  process.exit(1);
}

console.log('\ntree shaking intact');
