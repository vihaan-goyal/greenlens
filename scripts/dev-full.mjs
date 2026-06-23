// `npm run dev:full` — run the Next dev server against the full Prisma catalog.
//
// The full catalog is now the default (see lib/data/index.ts), so this is
// equivalent to `npm run dev`; kept as an explicit, self-documenting alias.
// Setting GREENLENS_REPO=prisma here is harmless reinforcement of that default.
// Cross-platform (no shell-specific env syntax, no extra dependency).

import { spawn } from 'node:child_process';

const child = spawn('next', ['dev'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, GREENLENS_REPO: 'prisma' },
});

child.on('exit', (code) => process.exit(code ?? 0));
