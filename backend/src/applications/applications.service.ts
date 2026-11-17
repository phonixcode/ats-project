import { Injectable, NotFoundException } from '@nestjs/common';
import { rm, rmdir } from 'fs/promises';
import { dirname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationStatus, HumanDecision } from '@prisma/client';
import { CreateReviewDto } from './dto/create-review.dto';
import { planShortlist, type ShortlistPlan } from './shortlist-plan';

@Injectable()
export class ApplicationsService {
  constructor(private prisma: PrismaService) {}

  create(data: {
    candidateId: string;
    jobId: string;
    batchId?: string;
    rawFilePath: string;
  }) {
    return this.prisma.application.create({
      data: { ...data, status: ApplicationStatus.UPLOADED },
    });
  }

  markFailed(
    id: string,
    reason: string,
    status: ApplicationStatus = ApplicationStatus.PARSE_FAILED,
  ) {
    return this.prisma.application.update({
      where: { id },
      data: { status, failureReason: reason },
    });
  }

  findByBatch(batchId?: string) {
    return this.prisma.application.findMany({
      where: { batchId },
      include: { score: true, modelOpinions: true, candidate: true },
    });
  }

  markParsing(id: string) {
    return this.prisma.application.update({
      where: { id },
      data: { status: ApplicationStatus.PARSING },
    });
  }

  markParsed(id: string, rawResumeText: string) {
    return this.prisma.application.update({
      where: { id },
      data: { status: ApplicationStatus.PARSED, rawResumeText },
    });
  }

  markExtracting(id: string) {
    return this.prisma.application.update({
      where: { id },
      data: { status: ApplicationStatus.EXTRACTING },
    });
  }

  markExtracted(id: string, parsedJson: any) {
    return this.prisma.application.update({
      where: { id },
      data: { status: ApplicationStatus.EXTRACTED, parsedJson },
    });
  }

  markScoring(id: string) {
    return this.prisma.application.update({
      where: { id },
      data: { status: ApplicationStatus.SCORING, failureReason: null },
    });
  }

  markScored(id: string) {
    return this.prisma.application.update({
      where: { id },
      data: { status: ApplicationStatus.PENDING_REVIEW },
    });
  }

  findOneWithJob(id: string) {
    return this.prisma.application.findUniqueOrThrow({
      where: { id },
      include: { job: true },
    });
  }

  async reviewMany(applicationIds: string[], humanDecision: HumanDecision) {
    const { count } = await this.prisma.review.createMany({
      data: applicationIds.map((applicationId) => ({
        applicationId,
        humanDecision,
      })),
    });
    return { reviewed: count };
  }

  async removeMany(applicationIds: string[]) {
    const applications = await this.prisma.application.findMany({
      where: { id: { in: applicationIds } },
      select: { candidateId: true, rawFilePath: true },
    });
    if (applications.length === 0) {
      throw new NotFoundException("We couldn't find those candidates.");
    }
    const candidateIds = [...new Set(applications.map((a) => a.candidateId))];

    await this.prisma.$transaction([
      this.prisma.application.deleteMany({
        where: { id: { in: applicationIds } },
      }),
      this.prisma.candidate.deleteMany({
        where: { id: { in: candidateIds }, applications: { none: {} } },
      }),
    ]);

    await Promise.all(
      applications.flatMap((a) =>
        a.rawFilePath ? [removeResumeFile(a.rawFilePath)] : [],
      ),
    );
    return { removed: applications.length };
  }

  async shortlistPlan(jobId: string, limit: number): Promise<ShortlistPlan> {
    const applications = await this.prisma.application.findMany({
      where: { jobId, failureReason: null, score: { isNot: null } },
      select: {
        id: true,
        candidate: { select: { name: true, email: true } },
        score: {
          select: { fitScore: true, bucket: true, fitRationaleJson: true },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { humanDecision: true },
        },
      },
    });

    const alreadyShortlisted = applications.filter(
      (a) => a.reviews[0]?.humanDecision === HumanDecision.SHORTLIST,
    ).length;
    const undecided = applications
      .filter((a) => a.reviews.length === 0 && a.score)
      .map((a) => {
        const rationale = a.score!.fitRationaleJson as { gaps?: unknown };
        const firstGap: unknown = Array.isArray(rationale?.gaps)
          ? rationale.gaps[0]
          : null;
        return {
          id: a.id,
          name: a.candidate.name,
          email: a.candidate.email,
          score: a.score!.fitScore,
          bucket: a.score!.bucket,
          worthAsking: typeof firstGap === 'string' ? firstGap : null,
        };
      });

    return planShortlist(undecided, alreadyShortlisted, limit);
  }

  async createReview(applicationId: string, dto: CreateReviewDto) {
    await this.prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
    });

    return this.prisma.review.create({
      data: {
        applicationId,
        humanDecision: dto.humanDecision,
        overrodeBucket: dto.overrodeBucket ?? false,
        note: dto.note,
      },
    });
  }

  async findOne(id: string) {
    const application = await this.prisma.application.findUniqueOrThrow({
      where: { id },
      include: {
        score: true,
        reviews: { orderBy: { createdAt: 'asc' } },
        candidate: true,
        interviewQuestions: true,
        modelOpinions: true,
        job: true,
      },
    });

    const siblings = await this.prisma.application.findMany({
      where: { jobId: application.jobId },
      select: {
        id: true,
        createdAt: true,
        score: { select: { fitScore: true } },
      },
    });
    siblings.sort((a, b) => {
      const scoreDelta = (b.score?.fitScore ?? -1) - (a.score?.fitScore ?? -1);
      if (scoreDelta !== 0) return scoreDelta;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    const index = siblings.findIndex((item) => item.id === id);

    return {
      ...application,
      previousId: siblings[index - 1]?.id ?? null,
      nextId: siblings[index + 1]?.id ?? null,
    };
  }

  findByJob(jobId: string) {
    return this.prisma.application.findMany({
      where: { jobId },
      omit: { rawResumeText: true, parsedJson: true },
      include: {
        score: true,
        candidate: true,
        modelOpinions: { select: { provider: true } },
        reviews: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

async function removeResumeFile(filePath: string) {
  await rm(filePath, { force: true });
  await rmdir(dirname(filePath)).catch(() => undefined);
}
