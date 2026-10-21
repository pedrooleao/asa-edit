import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Em desenvolvimento: rode `npm run servidor` (porta 8730) e `npm run ui`.
// O Vite repassa /ws e /esquema.json para o servidor local.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: { outDir: path.join(__dirname, '..', 'app', 'ui-dist'), emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:8730', ws: true },
      '/esquema.json': 'http://127.0.0.1:8730',
    },
  },
});
