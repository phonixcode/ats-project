import { Module } from '@nestjs/common';
import { BatchesService } from './batches.service';

@Module({
  providers: [BatchesService],
  exports: [BatchesService],
})
export class BatchesModule {}
