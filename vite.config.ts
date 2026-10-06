import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import manifest from './manifest.json' with { type: 'json' };

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@content': resolve(__dirname, 'src/content'),
      '@sidepanel': resolve(__dirname, 'src/sidepanel'),
      '@background': resolve(__dirname, 'src/background'),
      '@services': resolve(__dirname, 'src/services'),
      '@security': resolve(__dirname, 'src/security'),
      '@validation': resolve(__dirname, 'src/validation'),
      '@storage': resolve(__dirname, 'src/storage'),
      '@i18n': resolve(__dirname, 'src/i18n'),
      '@profiles': resolve(__dirname, 'src/profiles'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'development' ? false : true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        popup: resolve(__dirname, 'popup.html'),
        options: resolve(__dirname, 'options.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
  test: {
    testTimeout: 15000,
  },
});
