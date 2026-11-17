import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  Body,
  Get,
  Logger,
  Param,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { CreateBatchDto } from './dto/create-batch.dto';
import { BatchesService } from './batches.service';
import { RESUME_EXTENSIONS } from './archive-extraction.service';
import { ProcessingService } from '../processing/processing.service';
import { uploadsRoot } from '../common/storage';

const MAX_UPLOAD_FILES = 1000;
const logger = new Logger('BatchesController');

@Controller('batches')
export class BatchesController {
  constructor(
    private batchesService: BatchesService,
    private processingService: ProcessingService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', MAX_UPLOAD_FILES, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(uploadsRoot(), 'incoming');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) =>
          cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (ext === '.zip' || RESUME_EXTENSIONS.has(ext)) {
          cb(null, true);
          return;
        }
        logger.warn(`Rejected upload ${file.originalname}: unsupported type`);
        cb(
          new BadRequestException(
            `${file.originalname} isn't a .zip, PDF or Word file.`,
          ),
          false,
        );
      },
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateBatchDto,
  ) {
    if (!files?.length) {
      throw new BadRequestException(
        'Choose at least one .zip, PDF or Word file.',
      );
    }
    const batch = await this.batchesService.create(dto.jobId, 0);
    this.processingService.enqueueIngest({
      batchId: batch.id,
      uploads: files.map((file) => ({
        originalName: file.originalname,
        path: file.path,
      })),
    });
    return batch;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.batchesService.findOne(id);
  }
}
