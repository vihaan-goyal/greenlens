import { PrismaClient } from '@prisma/client';

// Single PrismaClient across hot reloads in dev — Next.js re-imports modules on
// every change, which would otherwise exhaust the SQLite connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Run the dev server and a bulk ingest against the same SQLite file at once
// without the reader hanging on the writer's lock:
//   - WAL lets readers proceed against a snapshot while a writer holds the lock.
//   - busy_timeout makes a blocked statement wait briefly instead of erroring.
// Fire-and-forget, once per process; WAL is persisted on the file thereafter.
if (!globalForPrisma.prisma) {
  void prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;').catch(() => {});
  void prisma.$executeRawUnsafe('PRAGMA busy_timeout=5000;').catch(() => {});
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
