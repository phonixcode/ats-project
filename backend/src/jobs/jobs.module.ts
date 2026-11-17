import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ProcessingModule } from '../processing/processing.module';
import { ApplicationsModule } from '../applications/applications.module';

@Module({
  imports: [ProcessingModule, ApplicationsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
