import { Module } from '@nestjs/common';
import { CallConfigModule } from '../call-config/call-config.module.js';
import { CallingController } from './calling.controller.js';
import { CallingService } from './calling.service.js';

@Module({
  imports: [CallConfigModule], // required-fields rules ke liye
  controllers: [CallingController],
  providers: [CallingService],
})
export class CallingModule {}
