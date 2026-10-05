import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  // Ye test REAL database use karta hai (local: docker, CI: postgres service)
  it('/api/health (GET) is public', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) =>
        expect(res.body).toEqual({
          status: 'ok',
          service: 'calling-crm-api',
          database: 'up',
          scheduler: 'disabled',
          version: 'dev',
          uptimeSec: expect.any(Number),
        }),
      );
  });

  afterEach(async () => {
    await app.close();
  });
});
