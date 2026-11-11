import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * vite serves the demo app and the dev server, nothing else.
 *
 * the published library is emitted by tsc (see tsconfig.build.json) as one file
 * per module: a pre-rolled single bundle cannot be tree shaken by a consumer's
 * bundler, which is the whole point of the package being composable.
 *
 * demo output goes to demo-dist/ so it never collides with the publishable dist/.
 */
export default defineConfig({
  base: '',
  build: {
    outDir: 'demo-dist',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        keyboard: fileURLToPath(new URL('./keyboard.html', import.meta.url)),
        keyboardGl: fileURLToPath(new URL('./keyboard-gl.html', import.meta.url)),
        fullGl: fileURLToPath(new URL('./full-gl.html', import.meta.url)),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
