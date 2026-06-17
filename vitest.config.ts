import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'extension/**/*.test.ts'],
    // Adapter tests need a DOM (DOMParser, document). Everything else stays node.
    environmentMatchGlobs: [['extension/content/adapters/**', 'jsdom']],
    reporters: 'default',
  },
});
