import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  root: import.meta.dirname,
  envDir: resolve(import.meta.dirname, '../..'),
  base: './',
  build: { outDir: resolve(import.meta.dirname, '../../dist'), emptyOutDir: true },
  server: { fs: { allow: [resolve(import.meta.dirname, '../..')] } },
  define: {
    __SHOWCASE_PUBLIC_PATH__: JSON.stringify(
      `/@fs/${resolve(import.meta.dirname, '../showcase/public').replaceAll('\\', '/')}/`,
    ),
  },
  plugins: [tailwindcss(), react()],
});
