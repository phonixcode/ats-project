import { Injectable } from '@nestjs/common';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessRemainingDto } from '../jobs/dto/process-remaining.dto';
import { DesktopQueueService } from '../queue/desktop-queue.service';
import type { IngestBatchJobData } from '../queue/job-data';

const UNREADABLE: ApplicationStatus[] = [
  ApplicationStatus.PARSE_FAILED,
  ApplicationStatus.EXTRACT_FAILED,
];

@Injectable()
export class ProcessingService {
  constructor(
    private prisma: PrismaService,
    private jobs: DesktopQueueService,
  ) {}

  async processRemaining(dto: ProcessRemainingDto) {
    const jobWhere: Prisma.JobWhereInput = {};
    if (dto.jobId) jobWhere.id = dto.jobId;
    if (dto.postedFrom || dto.postedTo) {
      jobWhere.postedAt = {};
      if (dto.postedFrom) jobWhere.postedAt.gte = new Date(dto.postedFrom);
      if (dto.postedTo) jobWhere.postedAt.lte = new Date(dto.postedTo);
    }

    const applications = await this.prisma.application.findMany({
      where: {
        job: jobWhere,
        NOT: { status: { in: UNREADABLE } },
      },
      include: {
        job: { select: { id: true, title: true } },
        modelOpinions: true,
        score: true,
      },
    });

    const byJob = new Map<
      string,
      { jobId: string; title: string; queued: number }
    >();
    let queued = 0;

    for (const application of applications) {
      const enqueued = this.enqueueIfNeeded(application);
      if (!enqueued) continue;
      queued += 1;
      const current = byJob.get(application.jobId) ?? {
        jobId: application.jobId,
        title: application.job.title,
        queued: 0,
      };
      current.queued += 1;
      byJob.set(application.jobId, current);
    }

    return { queued, byJob: [...byJob.values()] };
  }

  async enqueueRescore(applicationId: string) {
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.SCORING, failureReason: null },
    });
    this.jobs.enqueueScore({ applicationId });
  }

  enqueueIngest(data: IngestBatchJobData) {
    this.jobs.enqueueIngest(data);
  }

  private enqueueIfNeeded(application: {
    id: string;
    candidateId: string;
    jobId: string;
    batchId: string | null;
    status: ApplicationStatus;
    rawFilePath: string | null;
    rawResumeText: string | null;
    parsedJson: Prisma.JsonValue;
    score: { id: string } | null;
    modelOpinions: { error: string | null; fitScore: number | null }[];
  }): boolean {
    const batchId = application.batchId ?? undefined;

    if (
      (application.status === ApplicationStatus.UPLOADED ||
        application.status === ApplicationStatus.PARSING) &&
      application.rawFilePath
    ) {
      this.jobs.enqueueParse({
        applicationId: application.id,
        candidateId: application.candidateId,
        filePath: application.rawFilePath,
        batchId,
      });
      return true;
    }

    if (
      (application.status === ApplicationStatus.PARSED ||
        application.status === ApplicationStatus.EXTRACTING) &&
      application.rawResumeText
    ) {
      this.jobs.enqueueExtract({
        applicationId: application.id,
        candidateId: application.candidateId,
        resumeText: application.rawResumeText,
        batchId,
      });
      return true;
    }

    const scoreStatuses = new Set<ApplicationStatus>([
      ApplicationStatus.EXTRACTED,
      ApplicationStatus.SCORING,
      ApplicationStatus.SCORED,
      ApplicationStatus.SCORE_FAILED,
    ]);
    const needsScore =
      scoreStatuses.has(application.status) ||
      (application.status === ApplicationStatus.PENDING_REVIEW &&
        this.panelIncomplete(application));

    if (needsScore && application.parsedJson) {
      const alreadyCounted =
        application.status === ApplicationStatus.PENDING_REVIEW;
      this.jobs.enqueueScore({
        applicationId: application.id,
        batchId: alreadyCounted ? undefined : batchId,
      });
      return true;
    }

    return false;
  }

  private panelIncomplete(application: {
    score: { id: string } | null;
    modelOpinions: { error: string | null; fitScore: number | null }[];
  }) {
    const successful = application.modelOpinions.filter(
      (opinion) => !opinion.error && opinion.fitScore != null,
    );
    return (
      !application.score ||
      successful.length === 0 ||
      application.modelOpinions.some((opinion) => opinion.error)
    );
  }
}
