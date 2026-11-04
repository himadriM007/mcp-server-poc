import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Read VITE_* variables from MCP-client/.env (one level up from web/).
  envDir: '..',
  server: { port: 5173 },
  preview: { port: 4173 },
  build: { outDir: 'dist', emptyOutDir: true },
});
