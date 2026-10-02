import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService], // aage assignment/import modules use karenge
})
export class CustomersModule {}
