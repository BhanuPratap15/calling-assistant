import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../common/redis.js';
import { ImportsService } from './imports.service.js';

export const IMPORT_QUEUE = 'imports';

/**
 * Import ko background me chalata hai (design doc 16: "admin UI responsive rahe").
 *
 *   Redis on (normal)        → BullMQ queue "imports" + worker (concurrency 1)
 *   SCHEDULER_ENABLED=false  → same process me turant (tests / Redis ke bina dev)
 *
 * Queue me sirf batchId jaata hai — data DB me hai (DB = source of truth).
 * Server restart → QUEUED / PROCESSING batches dobara queue (processBatch idempotent hai).
 */
@Injectable()
export class ImportRunner implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ImportRunner.name);
  private queue?: Queue;
  private worker?: Worker;
  private readonly inline = new Set<Promise<void>>(); // tests: chalte hue imports ka wait

  constructor(
    private readonly imports: ImportsService,
    config: ConfigService,
  ) {
    if (config.get('SCHEDULER_ENABLED') === 'false') return;
    const connection = redisConnection(
      config.get('REDIS_URL', 'redis://localhost:6379'),
    );
    this.queue = new Queue(IMPORT_QUEUE, {
      connection,
      // jobId = batchId: same batch do baar queue nahi hota; complete/fail ke baad hata do (retry ho sake)
      defaultJobOptions: { removeOnComplete: true, removeOnFail: true },
    });
    this.worker = new Worker(
      IMPORT_QUEUE,
      async (job) => this.imports.processBatch(job.data.batchId as string),
      { connection, concurrency: 1 },
    );
    this.worker.on('error', (e) => this.logger.error('Import worker error', e));
  }

  async onApplicationBootstrap() {
    const pending = await this.imports.pendingBatchIds();
    for (const id of pending) await this.enqueue(id);
    if (pending.length)
      this.logger.log(`Re-queued ${pending.length} unfinished import(s)`);
  }

  async enqueue(batchId: string): Promise<void> {
    if (this.queue) {
      await this.queue.add('import', { batchId }, { jobId: batchId });
      return;
    }
    // Redis nahi → isi process me, request ke baad (response turant jaata hai)
    const run = new Promise<void>((resolve) => setImmediate(resolve))
      .then(() => this.imports.processBatch(batchId))
      .finally(() => this.inline.delete(run));
    this.inline.add(run);
  }

  /** Tests ke liye: inline imports khatam hone tak ruko */
  async idle(): Promise<void> {
    while (this.inline.size) await Promise.all(this.inline);
  }

  async onModuleDestroy() {
    await this.idle();
    await this.worker?.close();
    await this.queue?.close();
  }
}
