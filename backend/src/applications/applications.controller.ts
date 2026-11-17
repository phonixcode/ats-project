import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { BulkApplicationsDto } from './dto/bulk-applications.dto';
import { BulkReviewDto } from './dto/bulk-review.dto';
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

  @Post('bulk-delete')
  removeMany(@Body() dto: BulkApplicationsDto) {
    return this.applicationsService.removeMany(dto.applicationIds);
  }

  @Post('bulk-review')
  reviewMany(@Body() dto: BulkReviewDto) {
    return this.applicationsService.reviewMany(
      dto.applicationIds,
      dto.humanDecision,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.applicationsService.removeMany([id]);
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
