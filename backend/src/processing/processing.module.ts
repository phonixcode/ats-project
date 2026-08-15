import { Module } from '@nestjs/common';
import { ProcessingService } from './processing.service';
import { QueueModule } from '../queue/queue.module';
import { BatchesController } from '../batches/batches.controller';
import { BatchesModule } from '../batches/batches.module';
import { ApplicationsController } from '../applications/applications.controller';
import { ApplicationsModule } from '../applications/applications.module';

@Module({
  imports: [QueueModule, BatchesModule, ApplicationsModule],
  controllers: [BatchesController, ApplicationsController],
  providers: [ProcessingService],
  exports: [ProcessingService],
})
export class ProcessingModule {}
