import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import PianoRoll from './PianoRoll';
import Layout from './Layout';

describe('PianoRoll', () => {
  let pianoRoll: PianoRoll;
  let mockContainer: Container;
  let mockLayout: Layout;

  beforeEach(() => {
    mockContainer = new Container();
    mockLayout = new Layout({
      width: 1200,
      height: 800,
      pianoHeight: 250
    });

    pianoRoll = new PianoRoll({
      container: mockContainer,
      layout: mockLayout
    });
  });

  describe('constructor', () => {
    it('should add piano roll container to parent container', () => {
      expect(mockContainer.children.length).toBe(1);
    });
  });

  describe('note graphics management', () => {
    it('should create graphics when starting a note', () => {
      const initialChildren = pianoRoll.container.children.length;
      pianoRoll.startNote(60, 'red');
      expect(pianoRoll.container.children.length).toBe(initialChildren + 1);
    });

    it('should handle multiple notes on same midi', () => {
      pianoRoll.startNote(60, 'red');
      pianoRoll.startNote(60, 'blue');
      expect(pianoRoll.container.children.length).toBe(2);
    });
  });
});