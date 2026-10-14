import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // ts-node (CommonJS via tsconfig.app.json); the preload resolves @default-project/* aliases.
    // Prisma spawns this without a shell, so no `VAR=…` prefixes here.
    seed: 'ts-node --transpile-only -P tsconfig.app.json -r ./prisma/register-paths.cjs prisma/seed.ts',
  },
  engine: 'classic',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
