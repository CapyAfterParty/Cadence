import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the build works from any static host or a local file server.
export default defineConfig({
  base: './',
  plugins: [react()],
});
