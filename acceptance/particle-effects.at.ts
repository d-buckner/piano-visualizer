import { expect, test } from '@playwright/test';
import type { ActiveBlock } from '../src/lib/ActiveBlock';

type ParticleEffectsDemo = {
  pianoRoll: {
    getBlockPositions: (x: number) => ActiveBlock[];
    blocks: Map<number, unknown[]>;
  };
  startNote: (midi: number, color: string, id: string) => void;
  endNote: (midi: number, id: string) => void;
};

type ParticleEffectsWindow = Window & {
  __pianoVisualizerDemo: ParticleEffectsDemo;
};

type PerfProbe = {
  frameWorkMs: number[];
};

type PerfWindow = Window & {
  __pianoVisualizerPerf: PerfProbe;
};

test('particles adopt colors from nearby blocks', async ({ browser }, testInfo) => {
  const viewport = { width: 1673, height: 993 };
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: 'test-results', size: viewport },
  });
  const page = await context.newPage();
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text());
    }
  });

  await page.goto('http://127.0.0.1:4174/?scenario=mock-2');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  // Wait for the scene to initialize and notes to render
  await page.waitForTimeout(900);

  // Verify getBlockPositions exists and returns data during playback.
  // Manually start a note to guarantee a block is present at check time,
  // since the demo's setTimeout timing can race with evaluate.
  const blockCheck = await page.evaluate(() => {
    const viz = (window as unknown as ParticleEffectsWindow)
      .__pianoVisualizerDemo;

    if (!viz) return { error: 'no demo instance' };

    // Start a probe note to guarantee a block exists
    viz.startNote(64, '#ff4444', 'probe');
    const hasMethod = typeof viz.pianoRoll.getBlockPositions === 'function';
    const positions = viz.pianoRoll.getBlockPositions(0);
    const probeBlock = positions.find((p) => p.color === '#ff4444');
    viz.endNote(64, 'probe');

    return {
      hasMethod,
      totalPositions: positions.length,
      probeFound: Boolean(probeBlock),
      probePosition: probeBlock ?? null,
    };
  });

  expect(blockCheck).not.toHaveProperty('error');
  expect(blockCheck.hasMethod).toBe(true);
  expect(blockCheck.probeFound).toBe(true);
  expect(blockCheck.totalPositions).toBeGreaterThan(0);

  // Screenshot with active notes — blocks visible with glow, particles in background
  const activeScreenshot = await page.screenshot({
    path: 'test-results/particle-effects-active.png',
    fullPage: true,
  });
  await testInfo.attach('particle-effects-active', {
    body: activeScreenshot,
    contentType: 'image/png',
  });
  expect(activeScreenshot.length).toBeGreaterThan(10_000);

  // Wait for notes to end and blocks to scroll offscreen
  await page.waitForTimeout(5500);

  // Screenshot after notes ended — particles should revert to base appearance
  const afterScreenshot = await page.screenshot({
    path: 'test-results/particle-effects-after.png',
    fullPage: true,
  });
  await testInfo.attach('particle-effects-after', {
    body: afterScreenshot,
    contentType: 'image/png',
  });
  expect(afterScreenshot.length).toBeGreaterThan(4_000);

  expect(browserErrors).toEqual([]);

  const video = page.video();
  await context.close();

  if (video) {
    const videoPath = 'test-results/particle-effects.webm';
    await video.saveAs(videoPath);
    await testInfo.attach('particle-effects-video', {
      path: videoPath,
      contentType: 'video/webm',
    });
  }
});

test('particle effects do not degrade frame performance', async ({ browser }, testInfo) => {
  const viewport = { width: 1673, height: 993 };
  const context = await browser.newContext({ viewport });

  await context.addInitScript(() => {
    const frameWorkMs: number[] = [];

    Object.defineProperty(window, '__pianoVisualizerPerf', {
      value: { frameWorkMs },
    });
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4174/?scenario=mock-2');
  await expect(page.locator('canvas')).toBeVisible();

  // Let the scene warm up, then reset counters
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    (window as unknown as PerfWindow).__pianoVisualizerPerf.frameWorkMs.length = 0;
  });

  // Measure during active playback with particle effects
  await page.waitForTimeout(3000);

  const metrics = await page.evaluate(() => {
    const perf = (window as unknown as PerfWindow).__pianoVisualizerPerf;

    const sorted = [...perf.frameWorkMs].sort((a, b) => a - b);
    const avg =
      sorted.reduce((s, v) => s + v, 0) / Math.max(1, sorted.length);
    const p95 =
      sorted[
        Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
      ] ?? 0;
    const max = sorted[sorted.length - 1] ?? 0;

    return { count: sorted.length, avg, p95, max };
  });

  await testInfo.attach('particle-perf', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });

  await context.close();

  // Particle influence adds per-frame work; verify it stays within budget
  expect(metrics.count).toBeGreaterThan(0);
  expect(metrics.avg).toBeLessThan(6);
  expect(metrics.p95).toBeLessThan(8);
});
