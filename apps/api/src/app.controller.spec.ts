import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;
  // Unit test me real DB nahi — "fake" (mock) PrismaService
  const prismaMock = { $queryRaw: vi.fn() };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports database up when query succeeds', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      const res = { status: vi.fn() };
      expect(await appController.getHealth(res as never)).toEqual({
        status: 'ok',
        service: 'calling-crm-api',
        database: 'up',
        scheduler: 'disabled', // unit test me queue nahi
        version: 'dev',
        uptimeSec: expect.any(Number),
      });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('reports database down when query fails', async () => {
      prismaMock.$queryRaw.mockRejectedValueOnce(new Error('no db'));
      const res = { status: vi.fn() };
      const result = await appController.getHealth(res as never);
      expect(result.database).toBe('down');
      expect(res.status).toHaveBeenCalledWith(503); // monitor / Docker ko "unhealthy"
    });
  });
});
