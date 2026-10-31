import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /tianque2/
export default defineConfig({
  base: process.env.BASE ?? '/tianque2/',
  plugins: [react()],
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
});
