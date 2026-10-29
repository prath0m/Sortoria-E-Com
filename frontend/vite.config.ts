/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const backend = process.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/media': { target: backend, changeOrigin: true },
      '/sitemap.xml': { target: backend, changeOrigin: true },
      '/robots.txt': { target: backend, changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    // Django reads this to modulepreload the current route's chunks (see apps/core/seo.py).
    manifest: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', 'zustand'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
