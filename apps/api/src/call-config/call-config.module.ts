import { Module } from '@nestjs/common';
import { CallConfigController } from './call-config.controller.js';
import { CallConfigService } from './call-config.service.js';

@Module({
  controllers: [CallConfigController],
  providers: [CallConfigService],
  exports: [CallConfigService], // Step 2.3: call save validation isse rules lega
})
export class CallConfigModule {}
