import { expect, test } from '@playwright/test';

type DemoWindow = Window & {
  __pianoVisualizerDemo?: {
    setRange: (centerMidi: number, visibleKeys: number) => void;
    getRange: () => { centerMidi: number; visibleKeys: number };
    setCenterMidi: (midi: number) => void;
    getCenterMidi: () => number;
    setVisibleKeys: (visibleKeys: number) => void;
    getVisibleKeys: () => number;
    setWidthFactor: (widthFactor: number) => void;
    getWidthFactor: () => number;
    startNote: (midi: number, color?: string, identifier?: string) => void;
    endNote: (midi: number, identifier?: string) => void;
    getBlockPositions: () => Array<{ color: string; height: number }>;
    heldNotes: number[];
    destroy: () => void;
    frameCount: number;
  };
};

function demo(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const viz = (window as DemoWindow).__pianoVisualizerDemo;
    if (!viz) {
      return { error: 'no demo instance' as const };
    }
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const before = viz.frameCount;

    viz.setRange(48, 30);
    const range = viz.getRange();
    viz.setCenterMidi(72);
    const center = viz.getCenterMidi();
    viz.setVisibleKeys(25);
    const visible = viz.getVisibleKeys();
    viz.setWidthFactor(1.25);
    const widthFactor = viz.getWidthFactor();

    viz.startNote(64, '#ff4444', 'probe');
    const held = [...viz.heldNotes];
    await nextFrame();
    const positions = viz.getBlockPositions().filter((block) => block.color === '#ff4444');
    viz.endNote(64, 'probe');
    const heldAfter = [...viz.heldNotes];

    return {
      range,
      center,
      visible,
      widthFactor,
      held,
      blockFound: positions.length === 1,
      heldAfter,
      rendering: viz.frameCount > before,
    };
  });
}

test('the composed visualizer exposes its documented API', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto('/');
  await page.waitForTimeout(600);

  const result = await demo(page);
  expect(result).not.toHaveProperty('error');

  expect(result.range).toEqual({ centerMidi: 48, visibleKeys: 30 });
  expect(result.center).toBe(72);
  expect(result.visible).toBe(25);
  expect(result.widthFactor).toBeCloseTo(1.25, 5);
  expect(result.held).toEqual([64]);
  expect(result.blockFound).toBe(true);
  expect(result.heldAfter).toEqual([]);
  expect(result.rendering).toBe(true);
});

test('destroy tears the scene down', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto('/');
  await page.waitForTimeout(600);

  const before = await page.evaluate(() => {
    const viz = (window as DemoWindow).__pianoVisualizerDemo!;
    const frames = viz.frameCount;
    const canvases = document.querySelectorAll('canvas').length;
    viz.destroy();
    return { frames, canvases };
  });
  expect(before.canvases).toBe(1);

  await page.waitForTimeout(400);

  const after = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas').length,
    frames: (window as DemoWindow).__pianoVisualizerDemo!.frameCount,
  }));

  expect(after.canvases).toBe(0);
  expect(after.frames).toBe(before.frames);
});

test('a second source holding the same key survives the first release', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto('/');
  await page.waitForTimeout(400);

  const result = await page.evaluate(async () => {
    const viz = (window as DemoWindow).__pianoVisualizerDemo!;
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    viz.startNote(60, '#111111', 'finger');
    viz.startNote(60, '#222222', 'midi');
    await nextFrame();
    const colors = new Set(viz.getBlockPositions().map((b) => b.color));
    const blocksWhileHeld = (colors.has('#111111') ? 1 : 0) + (colors.has('#222222') ? 1 : 0);

    viz.endNote(60, 'midi');
    await nextFrame();
    const blocksAfterOneRelease = viz.getBlockPositions().filter((b) => b.color === '#111111').length;
    const stillHeld = viz.heldNotes.filter((midi) => midi === 60).length;

    viz.endNote(60, 'finger');
    await nextFrame();
    const heldAfterBoth = viz.heldNotes.filter((midi) => midi === 60).length;

    return { blocksWhileHeld, blocksAfterOneRelease, stillHeld, heldAfterBoth };
  });

  expect(result.blocksWhileHeld).toBe(2);
  expect(result.blocksAfterOneRelease).toBe(1);
  expect(result.stillHeld).toBe(1);
  // the released block keeps falling as a tail; what has to clear is the key
  expect(result.heldAfterBoth).toBe(0);
});
