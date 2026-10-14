// `npx prisma db seed` entry point (runner: prisma.config.ts → migrations.seed).
import { Logger } from '@nestjs/common';
import { seed } from './seed/index';

async function main(): Promise<void> {
  const logger = new Logger('seed');
  for (const s of await seed()) {
    logger.log(
      `${s.slug}: ${s.lines} lines, ${s.items} items, ${s.utilities} utilities, ${s.rooms} rooms, ${s.components} BOQ components, ${s.deliveries} deliveries`,
    );
  }
}

main().catch((error: unknown) => {
  new Logger('seed').error(error);
  process.exit(1);
});
