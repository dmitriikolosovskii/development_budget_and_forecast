import { PrismaClient } from '@prisma/client';
import { runSeed, type SeedStats } from '../../src/seed-data/write-seed';

/** Writes the demo data (block 03). The data and the writer live in src/seed-data, where Jest tests them. */
export async function seed(): Promise<SeedStats[]> {
  const prisma = new PrismaClient();
  try {
    return await runSeed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
