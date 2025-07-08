# Piano Visualizer

A piano roll visualizer built with PixiJS. Displays notes as they're played with a scrolling piano roll interface and interactive piano keyboard.

## Installation

```bash
npm install piano-visualizer
```

## Usage

```typescript
import Visualization from 'piano-visualizer';

const viz = new Visualization({
  container: document.getElementById('piano-container'),
  backgroundColor: 'black',
  onKeyDown: (midi) => {
    return '#ff0000'; // Optional: return a color for this note
  },
  onKeyUp: (midi) => {
    // Handle key release
  }
});

// Start a note
viz.startNote(60, '#00ff00'); // Middle C in green

// End a note
viz.endNote(60);

// Cleanup
viz.destroy();
```

## API

### Constructor Options

```typescript
interface Config {
  container: HTMLElement;
  backgroundColor?: ColorSource;
  onKeyDown?: (midi: number) => string | undefined;
  onKeyUp?: (midi: number) => void;
}
```

### Methods

- `startNote(midi: number, color?: string, identifier?: string)` - Start visualizing a note
- `endNote(midi: number, identifier?: string)` - Stop visualizing a note  
- `destroy()` - Clean up resources

## Development

```bash
npm install
npm run dev     # Start development server
npm run build   # Build for production
npm run test    # Run tests
```
