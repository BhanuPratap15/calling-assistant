import { Module } from '@nestjs/common';
import { ImportRunner } from './import-runner.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, ImportRunner],
})
export class ImportsModule {}
