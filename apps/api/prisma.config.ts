// Prisma CLI ka config (migrate, generate, studio isi file ko padhte hain).
// .env repo ke root pe hai, isliye path '../../.env' diya hai.
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '../../.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
