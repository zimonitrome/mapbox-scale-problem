import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [nodePolyfills(), solidPlugin()],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
  base: '/mapbox-scale-problem/'
});