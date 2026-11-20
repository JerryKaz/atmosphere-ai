import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The Gemini key is read from VITE_GEMINI_API_KEY via import.meta.env.
// Anything prefixed VITE_ ships to the browser; see README "Security".
export default defineConfig({
  base: '/atmosphere-ai/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy libraries so the app code changes don't bust their cache.
        manualChunks: {
          charts: ['recharts'],
          ai: ['@google/genai'],
          motion: ['motion'],
        },
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
