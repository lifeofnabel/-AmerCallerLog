import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Caller Log läuft unter https://<easy-consulting>/callerlog/ – auch lokal, damit alle Pfade gleich sind.
export default defineConfig({
  base: '/callerlog/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5174, strictPort: true },
});
