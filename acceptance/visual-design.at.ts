import { expect, test } from '@playwright/test';

const SCENARIOS = [
  {
    name: 'desktop',
    viewport: { width: 1673, height: 993 },
    minScreenshotBytes: 10_000,
  },
  {
    name: 'narrow',
    viewport: { width: 390, height: 844 },
    minScreenshotBytes: 4_000,
  },
] as const;

for (const scenario of SCENARIOS) {
  test(`captures mock-2 visual design screenshot - ${scenario.name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      viewport: scenario.viewport,
      recordVideo: {
        dir: 'test-results',
        size: scenario.viewport,
      },
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
    await expect(canvas).toHaveJSProperty('width', scenario.viewport.width);
    await expect(canvas).toHaveJSProperty('height', scenario.viewport.height);

    await page.waitForTimeout(900);

    const metrics = await page.evaluate(() => {
      const canvasElement = document.querySelector('canvas');
      const bounds = canvasElement?.getBoundingClientRect();

      return {
        hasDemo: Boolean('__pianoVisualizerDemo' in window),
        width: bounds?.width ?? 0,
        height: bounds?.height ?? 0,
        bodyWidth: document.body.clientWidth,
        bodyHeight: document.body.clientHeight,
      };
    });

    expect(metrics.hasDemo).toBe(true);
    expect(metrics.width).toBe(scenario.viewport.width);
    expect(metrics.height).toBe(scenario.viewport.height);
    expect(metrics.bodyWidth).toBe(scenario.viewport.width);
    expect(metrics.bodyHeight).toBe(scenario.viewport.height);

    const screenshot = await page.screenshot({
      path: `test-results/mock-2-${scenario.name}.png`,
      fullPage: true,
    });
    await testInfo.attach(`mock-2-${scenario.name}`, {
      body: screenshot,
      contentType: 'image/png',
    });

    expect(screenshot.length).toBeGreaterThan(scenario.minScreenshotBytes);
    expect(browserErrors).toEqual([]);

    const video = page.video();
    await context.close();

    if (video) {
      const videoPath = `test-results/mock-2-${scenario.name}.webm`;
      await video.saveAs(videoPath);
      await testInfo.attach(`mock-2-${scenario.name}-video`, {
        path: videoPath,
        contentType: 'video/webm',
      });
    }
  });
}
