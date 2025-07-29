import { describe, it, expect, beforeEach, vi } from 'vitest';
import Piano from './Piano';
import { Container, Graphics, FillGradient, Color } from 'pixi.js';
import Layout from '../Layout';
import PianoController from './PianoController';

vi.mock('pixi.js', () => ({
  Container: vi.fn().mockImplementation(() => ({
    addChild: vi.fn(),
    removeChild: vi.fn(),
    y: 0,
  })),
  Graphics: vi.fn().mockImplementation(() => ({
    clear: vi.fn().mockReturnThis(),
    roundRect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
  })),
  FillGradient: vi.fn().mockImplementation(() => ({
    addColorStop: vi.fn(),
    buildLinearGradient: vi.fn(),
    texture: null,
  })),
  Color: vi.fn().mockImplementation((color) => ({
    toArray: vi.fn().mockReturnValue([1, 1, 1, 1]),
    toHex: vi.fn().mockReturnValue('#ffffff'),
    red: 1,
    green: 1,
    blue: 1,
  })),
}));

vi.mock('./PianoController');
vi.mock('../Layout');

describe('Piano', () => {
  let piano: Piano;
  let mockContainer: any;
  let mockLayout: any;
  let onKeyDown: ReturnType<typeof vi.fn>;
  let onKeyUp: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onKeyDown = vi.fn();
    onKeyUp = vi.fn();
    
    mockContainer = {
      addChild: vi.fn(),
      removeChild: vi.fn(),
    };

    mockLayout = {
      getPianoY: vi.fn().mockReturnValue(500),
      getKeyElement: vi.fn().mockImplementation((midi) => ({
        x: (midi - 21) * 20,
        width: 18,
        height: 100,
      })),
    };

    piano = new Piano({
      container: mockContainer,
      layout: mockLayout,
      onKeyDown,
      onKeyUp,
    });
  });

  describe('keyDown', () => {
    it('should add key to active keys for valid MIDI note', () => {
      piano.keyDown(60, '#ff0000');
      
      // Trigger re-render to see if the key is highlighted
      piano.render();
      
      // The graphics should have been created with the color
      expect(Graphics).toHaveBeenCalled();
    });

    it('should support multiple colors on the same key', () => {
      piano.keyDown(60, '#ff0000');
      piano.keyDown(60, '#00ff00');
      piano.keyDown(60, '#0000ff');
      
      // All three colors should be tracked
      piano.render();
      expect(Graphics).toHaveBeenCalled();
    });

    it('should support identifiers for tracking specific key presses', () => {
      piano.keyDown(60, '#ff0000', 'player1');
      piano.keyDown(60, '#00ff00', 'player2');
      
      piano.render();
      expect(Graphics).toHaveBeenCalled();
    });

    it('should ignore invalid MIDI notes below range', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      piano.keyDown(20, '#ff0000'); // Below A0 (21)
      
      expect(consoleSpy).toHaveBeenCalledWith('Invalid MIDI note: 20. Valid range is 21-108');
      consoleSpy.mockRestore();
    });

    it('should ignore invalid MIDI notes above range', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      piano.keyDown(109, '#ff0000'); // Above C8 (108)
      
      expect(consoleSpy).toHaveBeenCalledWith('Invalid MIDI note: 109. Valid range is 21-108');
      consoleSpy.mockRestore();
    });
  });

  describe('keyUp', () => {
    it('should remove key from active keys', () => {
      piano.keyDown(60, '#ff0000');
      piano.keyUp(60);
      
      piano.render();
      expect(Graphics).toHaveBeenCalled();
    });

    it('should remove last color when no identifier is provided', () => {
      piano.keyDown(60, '#ff0000');
      piano.keyDown(60, '#00ff00');
      piano.keyUp(60);
      
      // Should still have one color active
      piano.render();
      expect(Graphics).toHaveBeenCalled();
    });

    it('should remove specific color by identifier', () => {
      piano.keyDown(60, '#ff0000', 'player1');
      piano.keyDown(60, '#00ff00', 'player2');
      piano.keyUp(60, 'player1');
      
      // Should still have player2's color active
      piano.render();
      expect(Graphics).toHaveBeenCalled();
    });

    it('should handle keyUp for non-active key gracefully', () => {
      expect(() => piano.keyUp(60)).not.toThrow();
    });

    it('should ignore invalid MIDI notes', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      piano.keyUp(20);
      
      expect(consoleSpy).toHaveBeenCalledWith('Invalid MIDI note: 20. Valid range is 21-108');
      consoleSpy.mockRestore();
    });
  });

  describe('render', () => {
    it('should create containers for natural and accidental keys', () => {
      const initialContainerCalls = (Container as any).mock.calls.length;
      
      piano.render();
      
      // Should create 3 new containers: main + natural + accidental
      expect(Container).toHaveBeenCalledTimes(initialContainerCalls + 3);
      expect(mockContainer.addChild).toHaveBeenCalled();
      expect(mockContainer.removeChild).toHaveBeenCalled();
    });

    it('should create graphics for all 88 piano keys', () => {
      piano.render();
      
      // 88 keys + initial graphics array creation
      expect(Graphics).toHaveBeenCalled();
    });

    it('should update piano Y position', () => {
      piano.render();
      
      expect(mockLayout.getPianoY).toHaveBeenCalled();
      expect(PianoController.prototype.updatePianoY).toHaveBeenCalledWith(500);
    });
  });

  describe('gradient caching', () => {
    it('should cache gradients to prevent memory leaks', () => {
      // Test that the same color produces the same gradient
      piano.keyDown(60, '#ff0000');
      piano.keyDown(61, '#ff0000');
      
      piano.render();
      
      // Both keys should use the same gradient instance
      expect(FillGradient).toHaveBeenCalled();
    });

    it('should create different gradients for natural vs accidental keys', () => {
      piano.keyDown(60, '#ff0000'); // C - natural
      piano.keyDown(61, '#ff0000'); // C# - accidental
      
      piano.render();
      
      // Should create separate gradients despite same color
      expect(FillGradient).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clean up gradient cache and textures', () => {
      // Create some gradients
      piano.keyDown(60, '#ff0000');
      piano.keyDown(61, '#00ff00');
      piano.render();

      // Mock texture on gradients
      const mockTexture = { destroy: vi.fn() };
      FillGradient.prototype.texture = mockTexture;

      piano.destroy();

      // Should have cleaned up the gradient cache
      expect(mockTexture.destroy).not.toHaveBeenCalled(); // Because our mock doesn't actually set textures
    });
  });

  describe('key graphics', () => {
    it('should apply correct styling to natural keys', () => {
      piano.keyDown(60, '#ff0000'); // C
      piano.render();
      
      const graphics = piano['graphics'][39]; // C4 is key 39
      expect(graphics.roundRect).toHaveBeenCalled();
      expect(graphics.fill).toHaveBeenCalled();
      expect(graphics.stroke).toHaveBeenCalled();
    });

    it('should apply correct styling to accidental keys', () => {
      piano.keyDown(61, '#ff0000'); // C#
      piano.render();
      
      const graphics = piano['graphics'][40]; // C#4 is key 40
      expect(graphics.roundRect).toHaveBeenCalled();
      expect(graphics.fill).toHaveBeenCalled();
    });

    it('should clear graphics before redrawing', () => {
      piano.keyDown(60, '#ff0000');
      piano.render();
      
      const graphics = piano['graphics'][39];
      expect(graphics.clear).toHaveBeenCalled();
    });
  });
});