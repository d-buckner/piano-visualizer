import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const SCENARIOS = [
  {
    name: 'desktop',
    viewport: { width: 1673, height: 993 },
  },
  {
    name: 'narrow',
    viewport: { width: 390, height: 844 },
  },
] as const;

type PerfReport = {
  scenario: string;
  viewport: { width: number; height: number };
  frameCount: number;
  frameIntervalAverageMs: number;
  frameIntervalP95Ms: number;
  frameIntervalP99Ms: number;
  frameIntervalMaxMs: number;
  frameIntervalOver32MsCount: number;
  visualizerWorkCount: number;
  visualizerWorkAverageMs: number;
  visualizerWorkP95Ms: number;
  visualizerWorkP99Ms: number;
  visualizerWorkMaxMs: number;
  visualizerWorkOver6MsCount: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
  canvas: { width: number; height: number };
};

for (const scenario of SCENARIOS) {
  test(`profiles mock-2 visual performance - ${scenario.name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      viewport: scenario.viewport,
    });

    await context.addInitScript(() => {
      const frameDeltas: number[] = [];
      const frameWorkMs: number[] = [];
      const longTasks: number[] = [];
      let lastFrameTime: number | undefined;
      let resetRequested = false;

      const tick = (time: number) => {
        if (resetRequested) {
          frameDeltas.length = 0;
          frameWorkMs.length = 0;
          longTasks.length = 0;
          lastFrameTime = undefined;
          resetRequested = false;
        }

        if (lastFrameTime !== undefined) {
          frameDeltas.push(time - lastFrameTime);
        }
        lastFrameTime = time;
        window.requestAnimationFrame(tick);
      };

      window.requestAnimationFrame(tick);

      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longTasks.push(entry.duration);
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch {
        // Long task observation is Chromium-only; frame timing is the primary signal.
      }

      Object.defineProperty(window, '__pianoVisualizerPerf', {
        value: {
          frameDeltas,
          frameWorkMs,
          longTasks,
          reset: () => {
            resetRequested = true;
          },
        },
      });
    });

    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4174/?scenario=mock-2');
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1_000);
    await page.evaluate(() => {
      window.__pianoVisualizerPerf?.reset();
    });
    await page.waitForTimeout(5_000);

    const rawMetrics = await page.evaluate(() => {
      const perf = (window as unknown as {
        __pianoVisualizerPerf: {
          frameDeltas: number[];
          frameWorkMs: number[];
          longTasks: number[];
        };
      }).__pianoVisualizerPerf;
      const canvas = document.querySelector('canvas');

      return {
        frameDeltas: perf.frameDeltas,
        frameWorkMs: perf.frameWorkMs,
        longTasks: perf.longTasks,
        canvas: {
          width: canvas?.width ?? 0,
          height: canvas?.height ?? 0,
        },
      };
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.start');
    await page.waitForTimeout(2_000);
    const profile = await cdp.send('Profiler.stop');

    await context.close();

    const sortedFrameDeltas = [...rawMetrics.frameDeltas].sort((a, b) => a - b);
    const sortedFrameWorkMs = [...rawMetrics.frameWorkMs].sort((a, b) => a - b);
    const percentile = (values: number[], value: number) => {
      if (values.length === 0) return 0;
      const index = Math.min(
        values.length - 1,
        Math.ceil(values.length * value) - 1,
      );
      return values[index];
    };
    const average = (values: number[]) => {
      return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    };
    const longTaskTotalMs = rawMetrics.longTasks.reduce((sum, value) => sum + value, 0);

    const report: PerfReport = {
      scenario: scenario.name,
      viewport: scenario.viewport,
      frameCount: rawMetrics.frameDeltas.length,
      frameIntervalAverageMs: average(rawMetrics.frameDeltas),
      frameIntervalP95Ms: percentile(sortedFrameDeltas, 0.95),
      frameIntervalP99Ms: percentile(sortedFrameDeltas, 0.99),
      frameIntervalMaxMs: Math.max(0, ...rawMetrics.frameDeltas),
      frameIntervalOver32MsCount: rawMetrics.frameDeltas.filter((value) => value > 32).length,
      visualizerWorkCount: rawMetrics.frameWorkMs.length,
      visualizerWorkAverageMs: average(rawMetrics.frameWorkMs),
      visualizerWorkP95Ms: percentile(sortedFrameWorkMs, 0.95),
      visualizerWorkP99Ms: percentile(sortedFrameWorkMs, 0.99),
      visualizerWorkMaxMs: Math.max(0, ...rawMetrics.frameWorkMs),
      visualizerWorkOver6MsCount: rawMetrics.frameWorkMs.filter((value) => value > 6).length,
      longTaskCount: rawMetrics.longTasks.length,
      longTaskTotalMs,
      longTaskMaxMs: Math.max(0, ...rawMetrics.longTasks),
      canvas: rawMetrics.canvas,
    };

    const reportPath = `test-results/perf-mock-2-${scenario.name}.json`;
    const profilePath = `test-results/perf-mock-2-${scenario.name}.cpuprofile`;

    await writeFile(reportPath, JSON.stringify(report, null, 2));
    await writeFile(profilePath, JSON.stringify(profile.profile));
    await testInfo.attach(`perf-mock-2-${scenario.name}`, {
      path: reportPath,
      contentType: 'application/json',
    });
    await testInfo.attach(`cpu-profile-mock-2-${scenario.name}`, {
      path: profilePath,
      contentType: 'application/json',
    });

    expect(report.frameCount).toBeGreaterThan(0);
    expect(report.visualizerWorkCount).toBeGreaterThan(0);
    expect(report.visualizerWorkAverageMs).toBeLessThan(6);
    expect(report.visualizerWorkP95Ms).toBeLessThan(8);
  });
}

declare global {
  interface Window {
    __pianoVisualizerPerf?: {
      frameDeltas: number[];
      frameWorkMs: number[];
      longTasks: number[];
      reset: () => void;
    };
  }
}
