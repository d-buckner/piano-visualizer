import { expect, test } from '@playwright/test';

type GLWindow = Window & {
  __pianoVisualizerGL?: { heldNotes: number[] };
};

function heldNotes(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as GLWindow).__pianoVisualizerGL?.heldNotes ?? null);
}

test('two fingers hold two notes at once', async ({ browser }) => {
  const viewport = { width: 1000, height: 700 };
  const context = await browser.newContext({ viewport, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/full-gl.html');
  await page.waitForTimeout(900);

  const client = await context.newCDPSession(page);
  const y = viewport.height - 60;

  const touch = (type: string, points: Array<[number, number]>) =>
    client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(([x, id]) => ({ x, y, id })),
    });

  await touch('touchStart', [[300, 1]]);
  await touch('touchStart', [[300, 1], [520, 2]]);
  await page.waitForTimeout(120);

  const both = await heldNotes(page);
  expect(both, 'a second finger must not steal the first note').toHaveLength(2);
  expect(new Set(both).size).toBe(2);

  // lifting one finger releases only that finger's note
  await touch('touchEnd', [[520, 2]]);
  await page.waitForTimeout(120);

  const one = await heldNotes(page);
  expect(one).toHaveLength(1);
  expect(one).toEqual([both![0]]);

  await touch('touchEnd', [[300, 1]]);
  await page.waitForTimeout(120);
  expect(await heldNotes(page)).toHaveLength(0);

  await context.close();
});

test('a dragged finger glides across keys', async ({ browser }) => {
  const viewport = { width: 1000, height: 700 };
  const context = await browser.newContext({ viewport, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/full-gl.html');
  await page.waitForTimeout(900);

  const client = await context.newCDPSession(page);
  const y = viewport.height - 60;

  const touch = (type: string, points: Array<[number, number]>) =>
    client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(([x, id]) => ({ x, y, id })),
    });

  await touch('touchStart', [[300, 1]]);
  await page.waitForTimeout(60);
  const first = (await heldNotes(page))![0];

  await touch('touchMove', [[620, 1]]);
  await page.waitForTimeout(60);
  const glided = await heldNotes(page);

  expect(glided).toHaveLength(1);
  expect(glided![0]).not.toBe(first);

  await context.close();
});
