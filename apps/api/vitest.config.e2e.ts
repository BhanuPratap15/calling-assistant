import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // E2E files ek-ek karke: sab same database share karte hain (assignment engine
    // "koi bhi eligible customer" uthata hai — parallel files ek doosre ka data le lengi)
    fileParallelism: false,
    // Background scheduler (Redis) band — tests FollowUpSchedulerService.tick() khud chalate hain
    env: {
      SCHEDULER_ENABLED: 'false',
      // Tests me direct prisma calls (bina HTTP request ke) default client (migration wala) pe
      TENANT_IMPLICIT_ORG_ID: '00000000-0000-4000-8000-000000000001',
    },
  },
});
