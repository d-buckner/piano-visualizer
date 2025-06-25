import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import terser from '@rollup/plugin-terser';


export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    rollupOptions: {
      plugins: [terser() as any]
    },
    lib: {
      entry: 'src/index.ts',
      name: 'piano-visualizer',
      fileName: 'index',
      formats: ['es'],
    },
  },
});