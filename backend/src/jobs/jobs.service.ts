import { Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, HumanDecision, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { asStringList, postingSnapshot } from './posting';
import {
  buildCandidateExportCsv,
  exportFilename,
  toExportRows,
} from './export-csv';
import type { ExportDecision } from './export-csv';

const PROCESSING_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.UPLOADED,
  ApplicationStatus.PARSING,
  ApplicationStatus.PARSED,
  ApplicationStatus.EXTRACTING,
  ApplicationStatus.EXTRACTED,
  ApplicationStatus.SCORING,
  ApplicationStatus.SCORED,
];

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateJobDto) {
    const snapshot = postingSnapshot({
      title: dto.title,
      description: dto.description,
      location: dto.location,
      workplace: dto.workplace,
      employmentType: dto.employmentType,
      seniority: dto.seniority,
      mustHaves: dto.mustHaves ?? [],
      niceToHaves: dto.niceToHaves ?? [],
      skills: dto.skills ?? [],
      minYears: dto.minYears,
      education: dto.education,
    });
    return this.prisma.job.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        workplace: dto.workplace,
        employmentType: dto.employmentType,
        seniority: dto.seniority,
        mustHaves: dto.mustHaves ?? [],
        niceToHaves: dto.niceToHaves ?? [],
        skills: dto.skills ?? [],
        minYears: dto.minYears,
        education: dto.education,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        salaryCurrency: dto.salaryCurrency,
        postedAt: dto.postedAt ? new Date(dto.postedAt) : undefined,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
        requirementsJson: snapshot,
      },
    });
  }

  async update(id: string, dto: UpdateJobDto) {
    const existing = await this.findOne(id);
    const mergedMustHaves = dto.mustHaves ?? asStringList(existing.mustHaves);
    const snapshot = postingSnapshot({
      title: dto.title ?? existing.title,
      description: dto.description ?? existing.description,
      location: dto.location ?? existing.location,
      workplace: dto.workplace ?? existing.workplace,
      employmentType: dto.employmentType ?? existing.employmentType,
      seniority: dto.seniority ?? existing.seniority,
      mustHaves: mergedMustHaves,
      niceToHaves: dto.niceToHaves ?? asStringList(existing.niceToHaves),
      skills: dto.skills ?? asStringList(existing.skills),
      minYears: dto.minYears ?? existing.minYears,
      education: dto.education ?? existing.education,
    });
    return this.prisma.job.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        workplace: dto.workplace,
        employmentType: dto.employmentType,
        seniority: dto.seniority,
        mustHaves: dto.mustHaves,
        niceToHaves: dto.niceToHaves,
        skills: dto.skills,
        minYears: dto.minYears,
        education: dto.education,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        salaryCurrency: dto.salaryCurrency,
        postedAt: dto.postedAt ? new Date(dto.postedAt) : undefined,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
        requirementsJson: snapshot,
      },
    });
  }

  async findAll(filters?: { postedFrom?: string; postedTo?: string }) {
    const where: Prisma.JobWhereInput = {};
    if (filters?.postedFrom || filters?.postedTo) {
      where.postedAt = {};
      if (filters.postedFrom) where.postedAt.gte = new Date(filters.postedFrom);
      if (filters.postedTo) where.postedAt.lte = new Date(filters.postedTo);
    }
    const jobs = await this.prisma.job.findMany({
      where,
      orderBy: { postedAt: 'desc' },
    });
    if (jobs.length === 0) return [];

    const jobIds = jobs.map((job) => job.id);
    const [statusCounts, scoredCounts, shortlisted] = await Promise.all([
      this.prisma.application.groupBy({
        by: ['jobId', 'status'],
        where: { jobId: { in: jobIds } },
        _count: { _all: true },
      }),
      this.prisma.application.groupBy({
        by: ['jobId'],
        where: { jobId: { in: jobIds }, score: { isNot: null } },
        _count: { _all: true },
      }),
      this.prisma.application.findMany({
        where: {
          jobId: { in: jobIds },
          reviews: { some: { humanDecision: HumanDecision.SHORTLIST } },
        },
        select: { jobId: true },
      }),
    ]);

    const statusMap = new Map<string, number>();
    for (const row of statusCounts) {
      statusMap.set(`${row.jobId}:${row.status}`, row._count._all);
    }
    const scoredMap = new Map(
      scoredCounts.map((row) => [row.jobId, row._count._all]),
    );
    const shortlistedMap = new Map<string, number>();
    for (const row of shortlisted) {
      shortlistedMap.set(row.jobId, (shortlistedMap.get(row.jobId) ?? 0) + 1);
    }

    return jobs.map((job) => {
      const count = (status: ApplicationStatus) =>
        statusMap.get(`${job.id}:${status}`) ?? 0;
      const applicationCount = statusCounts
        .filter((row) => row.jobId === job.id)
        .reduce((sum, row) => sum + row._count._all, 0);
      const processingCount = PROCESSING_STATUSES.reduce(
        (sum, status) => sum + count(status),
        0,
      );
      const pendingReview = count(ApplicationStatus.PENDING_REVIEW);
      const scoredCount = scoredMap.get(job.id) ?? 0;
      return {
        ...job,
        applicationCount,
        scoredCount,
        unreviewedCount: pendingReview,
        shortlistedCount: shortlistedMap.get(job.id) ?? 0,
        processingCount,
      };
    });
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException(
        "We couldn't find that role. It may have been removed.",
      );
    }
    return job;
  }

  async exportCandidates(id: string, decision: ExportDecision = 'SHORTLIST') {
    const job = await this.findOne(id);
    const applications = await this.prisma.application.findMany({
      where: { jobId: id },
      include: {
        candidate: true,
        score: true,
        reviews: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const rows = toExportRows(job, applications, decision);
    return {
      csv: buildCandidateExportCsv(rows),
      filename: exportFilename(job.title, decision, new Date()),
      count: rows.length,
    };
  }
}
