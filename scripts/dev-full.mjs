// `npm run dev:full` — run the Next dev server against the full Prisma catalog.
//
// Sets GREENLENS_REPO=prisma so both the UI and the extension's /api/resolve
// endpoint read the same ingested catalog (thousands of products), then the
// "see full breakdown" links resolve to pages that actually exist. Cross-platform
// (no shell-specific env syntax, no extra dependency).

import { spawn } from 'node:child_process';

const child = spawn('next', ['dev'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, GREENLENS_REPO: 'prisma' },
});

child.on('exit', (code) => process.exit(code ?? 0));
