import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BatchStatus } from '@prisma/client';

@Injectable()
export class BatchesService {
  constructor(private prisma: PrismaService) {}

  create(jobId: string, totalFiles: number) {
    return this.prisma.batch.create({
      data: { jobId, totalFiles, status: BatchStatus.PROCESSING },
    });
  }

  setTotalFiles(batchId: string, totalFiles: number) {
    return this.prisma.batch.update({
      where: { id: batchId },
      data: { totalFiles },
    });
  }

  async incrementProcessed(batchId: string, failed = false) {
    return this.prisma.batch.update({
      where: { id: batchId },
      data: {
        processedCount: { increment: 1 },
        ...(failed && { failedCount: { increment: 1 } }),
      },
    });
  }

  async finalize(batchId: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new NotFoundException(`Batch ${batchId} not found`);
    const status =
      batch.failedCount === 0
        ? BatchStatus.COMPLETED
        : batch.failedCount === batch.totalFiles
          ? BatchStatus.FAILED
          : BatchStatus.COMPLETED_WITH_ERRORS;
    return this.prisma.batch.update({
      where: { id: batchId },
      data: { status },
    });
  }

  async findOne(id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException(`Batch ${id} not found`);
    return batch;
  }

  async checkAndFinalize(batchId: string) {
    const batch = await this.prisma.batch.findUniqueOrThrow({
      where: { id: batchId },
    });

    if (batch.totalFiles === 0) {
      await this.prisma.batch.update({
        where: { id: batchId },
        data: { status: BatchStatus.FAILED },
      });
      return;
    }

    const terminalCount = await this.prisma.application.count({
      where: {
        batchId,
        status: {
          in: [
            'PENDING_REVIEW',
            'PARSE_FAILED',
            'EXTRACT_FAILED',
            'SCORE_FAILED',
          ],
        },
      },
    });
    if (terminalCount < batch.totalFiles) return;

    const status =
      batch.failedCount === 0
        ? BatchStatus.COMPLETED
        : batch.failedCount === batch.totalFiles
          ? BatchStatus.FAILED
          : BatchStatus.COMPLETED_WITH_ERRORS;
    await this.prisma.batch.update({
      where: { id: batchId },
      data: { status },
    });
  }

  markFailed(batchId: string) {
    return this.prisma.batch.update({
      where: { id: batchId },
      data: { status: BatchStatus.FAILED },
    });
  }
}
