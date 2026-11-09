// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { swPrecache } from './scripts/sw-precache-integration.mjs';

export default defineConfig({
  site: 'https://mi-entrenamiento.vercel.app',
  output: 'static',
  integrations: [react(), swPrecache()],
  vite: {
    plugins: [tailwindcss()],
  },
});
