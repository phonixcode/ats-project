import { Injectable } from '@nestjs/common';
import { AuthenticitySignal, Bucket, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ConsensusResult } from './ensemble';

@Injectable()
export class ScoresService {
  constructor(private prisma: PrismaService) {}

  upsertConsensus(applicationId: string, consensus: ConsensusResult) {
    const data = {
      fitScore: consensus.fitScore,
      fitRationaleJson: consensus.rationale as unknown as Prisma.InputJsonValue,
      authenticitySignal: consensus.authenticitySignal as AuthenticitySignal,
      authenticityReasoning: consensus.authenticityReasoning,
      bucket: consensus.bucket as Bucket,
      disagreement: consensus.disagreement,
    };
    return this.prisma.score.upsert({
      where: { applicationId },
      create: { applicationId, ...data },
      update: data,
    });
  }

  deleteForApplication(applicationId: string) {
    return this.prisma.score.deleteMany({ where: { applicationId } });
  }
}
