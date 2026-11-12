import { describe, it, expect } from 'vitest';
import NoteRoll from './NoteRoll.js';
import Layout from '../Layout.js';
import type QuadRenderer from './QuadRenderer.js';

type Push = [number, number, number, number, number, number, number, ...unknown[]];

function makeRenderer() {
  const calls: Push[] = [];
  return {
    calls,
    push: (...args: unknown[]) => calls.push(args as Push),
  };
}

function makeLayout() {
  return new Layout({ width: 900, height: 600, pianoHeight: 200 });
}

describe('NoteRoll', () => {
  it('draws a glow stack under each block', () => {
    const layout = makeLayout();
    const roll = new NoteRoll(layout);
    const renderer = makeRenderer();

    roll.startNote(60, '#62d982');
    roll.render(renderer as unknown as QuadRenderer, 16);

    // 4 glow steps plus the body, and glow instances come first
    expect(renderer.calls).toHaveLength(5);
    expect(renderer.calls[0]![6]).toBeLessThan(1); // glow alpha
    expect(renderer.calls[4]![6]).toBe(1); // body alpha
  });

  it('scrolls and removes a block once it leaves the roll', () => {
    const layout = makeLayout();
    const roll = new NoteRoll(layout);
    const renderer = makeRenderer();

    roll.startNote(60, '#62d982');
    roll.endNote(60);
    expect(roll.activeCount).toBe(1);

    // 400px of roll at 0.2px/ms, plus the block's own height
    for (let frame = 0; frame < 400; frame++) {
      roll.render(renderer as unknown as QuadRenderer, 16);
    }

    expect(roll.activeCount).toBe(0);
  });

  it('keeps blocks apart by identifier', () => {
    const layout = makeLayout();
    const roll = new NoteRoll(layout);

    roll.startNote(60, '#62d982', 'a');
    roll.startNote(60, '#4d91ff', 'b');
    roll.endNote(60, 'a');

    const positions = roll.getBlockPositions();
    expect(positions).toHaveLength(2);
    expect(positions.map((block) => block.color)).toContain('#4d91ff');
  });

  it('reports screen-space rects for the particle field', () => {
    const layout = makeLayout();
    const roll = new NoteRoll(layout);
    const renderer = makeRenderer();

    roll.startNote(60, '#62d982');
    roll.render(renderer as unknown as QuadRenderer, 16);

    const [block] = roll.getBlockPositions();
    expect(block?.color).toBe('#62d982');
    expect(block!.width).toBeGreaterThan(0);
    expect(block!.y).toBeGreaterThan(0);
    expect(block!.y).toBeLessThanOrEqual(layout.getPianoRollHeight());
  });

  it('culls blocks that have scrolled out of the roll', () => {
    const layout = makeLayout();
    const roll = new NoteRoll(layout);
    const renderer = makeRenderer();

    roll.startNote(60, '#62d982');
    roll.endNote(60);
    for (let frame = 0; frame < 60; frame++) {
      roll.render(renderer as unknown as QuadRenderer, 16);
    }

    // still alive (it is on its way out) but no longer inside the roll
    const tall = roll.getBlockPositions();
    expect(tall.every((block) => block.y <= layout.getPianoRollHeight())).toBe(true);
  });
});
