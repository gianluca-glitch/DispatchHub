import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

// Neon cold-start warmup: fire once when serverless function loads
const g = typeof globalThis !== 'undefined' ? (globalThis as { __dbWarmed?: boolean }) : undefined;
if (g && !g.__dbWarmed) {
  g.__dbWarmed = true;
  db.$queryRaw`SELECT 1`.catch(() => {});
}
