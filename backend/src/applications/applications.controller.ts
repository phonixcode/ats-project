import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ProcessingService } from '../processing/processing.service';

@Controller('applications')
export class ApplicationsController {
  constructor(
    private applicationsService: ApplicationsService,
    private processingService: ProcessingService,
  ) {}

  @Get()
  findByBatch(
    @Query('batchId') batchId?: string,
    @Query('jobId') jobId?: string,
  ) {
    if (jobId) return this.applicationsService.findByJob(jobId);
    return this.applicationsService.findByBatch(batchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.applicationsService.findOne(id);
  }

  @Post(':id/reviews')
  createReview(@Param('id') id: string, @Body() dto: CreateReviewDto) {
    return this.applicationsService.createReview(id, dto);
  }

  @Post(':id/rescore')
  rescore(@Param('id') id: string) {
    return this.processingService.enqueueRescore(id);
  }
}
