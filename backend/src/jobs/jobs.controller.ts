import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { ProcessRemainingDto } from './dto/process-remaining.dto';
import { ExportCandidatesDto } from './dto/export-candidates.dto';
import { ProcessingService } from '../processing/processing.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private jobsService: JobsService,
    private processingService: ProcessingService,
  ) {}

  @Post()
  create(@Body() dto: CreateJobDto) {
    return this.jobsService.create(dto);
  }

  @Post('process-remaining')
  processRemaining(@Body() dto: ProcessRemainingDto) {
    return this.processingService.processRemaining(dto);
  }

  @Get()
  findAll(
    @Query('postedFrom') postedFrom?: string,
    @Query('postedTo') postedTo?: string,
  ) {
    return this.jobsService.findAll({ postedFrom, postedTo });
  }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query() query: ExportCandidatesDto,
  ) {
    const { csv, filename } = await this.jobsService.exportCandidates(
      id,
      query.decision ?? 'SHORTLIST',
    );
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobsService.update(id, dto);
  }
}
