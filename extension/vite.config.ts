import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import manifest from './manifest.json' with { type: 'json' };

/**
 * Vite config for the browser extension build. The Next.js app under /app
 * is built separately (`next build`); this config only handles the MV3 zip.
 *
 * Path alias mirrors the project tsconfig so /lib/domain and /styles import
 * the same way from both contexts.
 */
// Stamped at build time so SW + content + popup all carry the same string.
// Lets us confirm at runtime whether a page still has an older content
// script injected (Chrome doesn't auto-re-inject into already-open tabs on
// extension reload — only on the next navigation).
const BUILD_ID = new Date().toISOString();

export default defineConfig({
  root: __dirname,
  // CRXJS has its own narrower ManifestV3 type that doesn't perfectly line up
  // with @types/chrome's definition — the JSON is the source of truth at runtime.
  plugins: [react(), crx({ manifest: manifest as unknown as Parameters<typeof crx>[0]['manifest'] })],
  define: {
    __GL_BUILD__: JSON.stringify(BUILD_ID),
  },
  resolve: {
    alias: {
      // `@/*` points to the project root so shared imports like
      // `@/lib/domain/scoring` work the same as in the Next.js app.
      '@': resolve(__dirname, '..'),
    },
  },
  build: {
    outDir: resolve(__dirname, '..', 'dist', 'extension'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
