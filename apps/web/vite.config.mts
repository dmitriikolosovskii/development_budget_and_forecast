/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

const apiTarget = `http://localhost:${process.env.API_PORT ?? 3454}`;

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  server: {
    port: Number(process.env.WEB_PORT ?? 4274),
    host: 'localhost',
    proxy: { '/api': apiTarget },
  },
  preview: {
    port: Number(process.env.PREVIEW_PORT ?? 4300),
    host: 'localhost',
    proxy: { '/api': apiTarget },
  },
  define: {
    // "Today" for schedule checks is pinned so the demo statuses do not drift (CONTRACTS §6).
    __DEMO_TODAY__: JSON.stringify(
      process.env.DEMO_TODAY === 'today'
        ? new Date().toISOString().slice(0, 10)
        : (process.env.DEMO_TODAY ?? '2026-10-14'),
    ),
  },
  plugins: [react(), tailwindcss(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    css: false,
    setupFiles: ['src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/web',
      provider: 'v8' as const,
    },
  },
}));
