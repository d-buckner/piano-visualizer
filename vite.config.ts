import { defineConfig } from 'vite';
import getProdConfig from './config/prod.config';
import getDevConfig from './config/dev.config';


const MODE_CONFIG_GETTERS = {
  production: getProdConfig,
  development: getDevConfig,
} as const

export default defineConfig(({ mode }) => {
  const configGetter = MODE_CONFIG_GETTERS[mode];
  if (!configGetter) {
    throw new Error(`Unknown mode ${mode}`);
  }

  return configGetter();
});
