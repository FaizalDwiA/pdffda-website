import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  root: 'web-src',
  base: './',
  build: {
    outDir: '../',
    emptyOutDir: false
  },
  server: {
    port: 1174,
    host: '0.0.0.0',
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  }
});
