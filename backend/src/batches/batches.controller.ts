import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  Get,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { CreateBatchDto } from './dto/create-batch.dto';
import { BatchesService } from './batches.service';
import { ProcessingService } from '../processing/processing.service';
import { uploadsRoot } from '../common/storage';

@Controller('batches')
export class BatchesController {
  constructor(
    private batchesService: BatchesService,
    private processingService: ProcessingService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(uploadsRoot(), 'incoming');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname}`),
      }),
      limits: { fileSize: 200 * 1024 * 1024 }, // 200MB cap on the zip itself
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateBatchDto,
  ) {
    const batch = await this.batchesService.create(dto.jobId, 0);
    this.processingService.enqueueArchive({
      batchId: batch.id,
      zipPath: file.path,
    });
    return batch;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.batchesService.findOne(id);
  }
}
