import { expect, test } from '@playwright/test';

type GLWindow = Window & {
  __pianoVisualizerDemo?: { contextLost: boolean; instanceCount: number };
};

function probe(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const viz = (window as GLWindow).__pianoVisualizerDemo;
    return {
      contextLost: viz?.contextLost ?? null,
      instances: viz?.instanceCount ?? null,
    };
  });
}

function setContext(page: import('@playwright/test').Page, action: 'lose' | 'restore') {
  return page.evaluate((which) => {
    // getContext returns null once the context is gone, so the extension has to
    // be grabbed while it is still alive and reused for the restore
    const store = window as unknown as { __loseContext?: WEBGL_lose_context };

    if (!store.__loseContext) {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      store.__loseContext = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    }

    if (which === 'lose') {
      store.__loseContext.loseContext();
    } else {
      store.__loseContext.restoreContext();
    }
  }, action);
}

test('recovers from a lost WebGL context', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/?stress=1');
  await page.waitForTimeout(1200);

  const clip = { x: 0, y: 0, width: 1000, height: 460 };

  const before = await probe(page);
  expect(before.contextLost).toBe(false);
  expect(before.instances).toBeGreaterThan(0);
  const beforeShot = await page.screenshot({ clip });

  await setContext(page, 'lose');
  await page.waitForTimeout(300);

  // drawing stops rather than throwing on every call
  expect((await probe(page)).contextLost).toBe(true);
  expect((await probe(page)).instances).toBe(0);
  const lostShot = await page.screenshot({ clip });

  await setContext(page, 'restore');
  await page.waitForTimeout(800);

  // without a restore handler the canvas stays blank until the page reloads
  const after = await probe(page);
  expect(after.contextLost).toBe(false);
  expect(after.instances).toBeGreaterThan(0);

  const afterShot = await page.screenshot({ clip });
  expect(afterShot.equals(lostShot)).toBe(false);
  expect(afterShot.length).toBeGreaterThan(1000);
  expect(beforeShot.length).toBeGreaterThan(1000);
});
