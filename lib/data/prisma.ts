import { PrismaClient } from '@prisma/client';

// Single PrismaClient across hot reloads in dev — Next.js re-imports modules on
// every change, which would otherwise open multiple connection pool instances.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
