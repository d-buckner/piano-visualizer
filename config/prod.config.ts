import dts from 'vite-plugin-dts';
import terser from '@rollup/plugin-terser';
import type { UserConfig } from 'vite';


export default function getProdConfig(): UserConfig {
  return {
    plugins: [
      dts({
        insertTypesEntry: true,
        rollupTypes: true,
      }),
    ],
    build: {
      rollupOptions: {
        // need to see if i'm missing a type update here
        // was working in another recent project with similar setup
        plugins: terser() as any
      },
      lib: {
        entry: 'src/index.ts',
        name: 'piano-visualizer',
        fileName: 'index',
        formats: ['es'],
      },
    },
  }
}
