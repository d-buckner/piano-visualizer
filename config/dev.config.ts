import type { UserConfig } from 'vite';


export default function getDevConfig(): UserConfig {
  return {
    base: '',
    build: {
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        }
      }
    }
  };
}
