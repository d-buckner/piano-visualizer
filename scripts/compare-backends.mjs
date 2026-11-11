/**
 * backend comparison: pixi vs the WebGL2 QuadRenderer prototype.
 *
 * answers the two questions that decide a rewrite: how many bytes does each
 * renderer cost a consumer, and what does each cost the main thread per frame.
 *
 * the full-scene rows are driven from here rather than from each demo, so both
 * backends see a byte-for-byte identical note schedule and the difference is
 * the renderer and nothing else.
 *
 * run: node scripts/compare-backends.mjs
 */
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const KEYBOARD = [
  { name: 'pixi keyboard', entry: 'src/demo-keyboard.ts', page: '/keyboard.html?stress=1' },
  { name: 'webgl2 keyboard', entry: 'src/demo-keyboard-gl.ts', page: '/keyboard-gl.html?stress=1' },
];

const FULL = [
  {
    name: 'pixi full scene',
    entry: 'src/demo.ts',
    page: '/index.html',
    drive: '__pianoVisualizerDemo',
  },
  {
    name: 'webgl2 full scene',
    entry: 'src/demo-full-gl.ts',
    page: '/full-gl.html',
    drive: '__pianoVisualizerGL',
  },
];

const kb = (bytes) => `${(bytes / 1024).toFixed(1)}kb`;

async function measureBytes(entry) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent',
    target: 'es2020',
  });

  const text = result.outputFiles[0].text;
  const inputs = Object.entries(result.metafile.inputs);
  // metafile.inputs reports source `bytes`; `bytesInOutput` lives on outputs
  const vendor = inputs
    .filter(([path]) => path.includes('node_modules'))
    .reduce((total, [, { bytes }]) => total + bytes, 0);
  const ours = inputs
    .filter(([path]) => !path.includes('node_modules'))
    .reduce((total, [, { bytes }]) => total + bytes, 0);
  return {
    raw: Buffer.byteLength(text),
    gzip: gzipSync(Buffer.from(text)).length,
    vendor,
    ours,
  };
}

/**
 * Prefer the full Chromium build over the headless shell: the shell rasterises
 * through SwiftShader, which measures the CPU pretending to be a GPU. The full
 * build with ANGLE Metal measures the actual thing.
 */
function findBrowser() {
  const cache = join(process.env.HOME ?? '', 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) {
    return {};
  }

  const full = readdirSync(cache)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort()
    .reverse();

  for (const dir of full) {
    const app = join(
      cache,
      dir,
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    );
    if (existsSync(app)) {
      return { executablePath: app, headless: false, args: ['--use-angle=metal'] };
    }
  }

  const shells = readdirSync(cache)
    .filter((name) => name.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse();

  for (const shell of shells) {
    const path = join(cache, shell, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
    if (existsSync(path)) {
      return { executablePath: path };
    }
  }

  return {};
}

/**
 * identical load for both backends: three sustained notes plus six short ones,
 * on a five second cycle, roughly the density of a three-player ensemble.
 */
async function drive(page, globalName) {
  await page.evaluate((name) => {
    const viz = window[name];
    if (!viz) {
      return;
    }

    viz.setRange(60, 52);

    const sustained = [
      { midi: 50, color: '#62d982' },
      { midi: 69, color: '#4d91ff' },
      { midi: 86, color: '#bd4ed8' },
    ];
    const short = [
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
      for (const note of sustained) {
        const id = `s${tag}-${note.midi}`;
        viz.startNote(note.midi, note.color, id);
        setTimeout(() => viz.endNote(note.midi, id), 5200);
      }
      for (const note of short) {
        const id = `x${tag}-${note.midi}`;
        setTimeout(() => {
          viz.startNote(note.midi, note.color, id);
          setTimeout(() => viz.endNote(note.midi, id), note.duration);
        }, note.delay);
      }
    };

    run();
    setInterval(run, 5200);
  }, globalName);
}

async function measureRuntime(browser, url, driveGlobal) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.waitForTimeout(400);

  if (driveGlobal) {
    await drive(page, driveGlobal);
  }
  await page.waitForTimeout(1600);

  const stats = await page.evaluate(async () => {
    const intervals = [];
    let last = performance.now();
    const started = last;

    await new Promise((resolve) => {
      const tick = () => {
        const now = performance.now();
        intervals.push(now - last);
        last = now;

        if (now - started < 3000) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });

    intervals.shift();
    intervals.sort((a, b) => a - b);
    const percentile = (fraction) =>
      intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * fraction))] ?? 0;
    const memory = /** @type {any} */ (performance).memory;

    return {
      fps: (intervals.length / (performance.now() - started)) * 1000,
      frameAvg: percentile(0.5),
      frameP99: percentile(0.99),
      worst: intervals[intervals.length - 1] ?? 0,
      heapMB: memory ? memory.usedJSHeapSize / 1024 / 1024 : null,
    };
  });

  await page.screenshot({ path: `backend-${url.replace(/[^a-z]/gi, '')}.png` });
  await page.close();

  return { ...stats, errors };
}

const port = 4189;
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port)], {
  stdio: 'ignore',
});
await new Promise((resolve) => setTimeout(resolve, 3500));

const launch = findBrowser();
const browser = await chromium.launch(launch);
console.log(
  launch.headless === false
    ? '\nrunning headed Chromium with ANGLE Metal (real GPU)\n'
    : '\nrunning headless shell (SwiftShader, software raster)\n',
);

const header = '\n                          bundle (min / gz)   renderer  ours    fps   frame avg/p99/worst    heap';
const rows = [];

for (const group of [KEYBOARD, FULL]) {
  const measured = [];
  for (const target of group) {
    const bytes = await measureBytes(target.entry);
    const runtime = await measureRuntime(browser, `http://127.0.0.1:${port}${target.page}`, target.drive);
    measured.push({ name: target.name, ...bytes, ...runtime });
  }
  rows.push(...measured);
  console.log(header);
  for (const row of measured) {
    console.log(
      `${row.name.padEnd(22)} ${kb(row.raw).padStart(7)} / ${kb(row.gzip).padStart(7)}  ` +
      `${kb(row.vendor).padStart(7)} ${kb(row.ours).padStart(7)}  ` +
      `${row.fps.toFixed(1).padStart(5)}  ` +
      `${row.frameAvg.toFixed(2)} / ${row.frameP99.toFixed(2)} / ${row.worst.toFixed(2)}ms  ` +
      `${row.heapMB ? `${row.heapMB.toFixed(1)}mb` : 'n/a'}`,
    );
    if (row.errors.length) {
      console.log(`  errors: ${row.errors.join('; ')}`);
    }
  }
  const [first, second] = measured;
  if (first && second) {
    console.log(
      `  gzip delta: ${((second.gzip / first.gzip - 1) * 100).toFixed(0)}% ` +
      `fps delta: ${((second.fps / first.fps - 1) * 100).toFixed(0)}% ` +
      `heap delta: ${second.heapMB && first.heapMB ? `${((second.heapMB / first.heapMB - 1) * 100).toFixed(0)}%` : 'n/a'}`,
    );
  }
  console.log('');
}

await browser.close();
server.kill('SIGKILL');
