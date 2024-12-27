import {defineConfig} from 'vite'

export default defineConfig({
    build: {
        minify: 'esbuild',
        lib: {
            name: 'piano-visualizer',
            entry: ['src/index.ts'],
            fileName: (format, entryName) => `${entryName}.${format}.js`,
        },
    },
})