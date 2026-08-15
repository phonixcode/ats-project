import { Injectable } from '@nestjs/common';
import { AuthenticitySignal, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRegistryService } from '../llm/provider-registry.service';
import type { ExtractedResumeData } from '../llm/llm-provider.interface';
import { jobToPosting } from '../jobs/posting';
import { mergeJudgeOpinions, type JudgeOpinion } from './ensemble';
import { ScoresService } from './scores.service';

@Injectable()
export class EnsembleScoringService {
  constructor(
    private registry: ProviderRegistryService,
    private prisma: PrismaService,
    private scoresService: ScoresService,
  ) {}

  async scoreApplication(applicationId: string) {
    const application = await this.prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: { job: true },
    });
    const posting = jobToPosting(application.job);
    const resumeData = application.parsedJson as unknown as ExtractedResumeData;
    const resumeText = application.rawResumeText ?? '';

    const { fit, authenticity, provider } = await this.registry.runWithFallback(
      async (candidate) => {
        const [fitResult, authenticityResult] = await Promise.all([
          candidate.scoreFit(resumeData, posting),
          candidate.assessAuthenticity(resumeText),
        ]);
        return {
          fit: fitResult,
          authenticity: authenticityResult,
          provider: candidate,
        };
      },
    );

    const opinion: JudgeOpinion = {
      provider: provider.name,
      model: provider.model,
      fitScore: fit.fitScore,
      rationale: fit.rationale,
      requirementChecks: fit.requirementChecks,
      authenticitySignal: authenticity.signal,
      authenticityReasoning: authenticity.reasoning,
    };

    await this.persistOpinion(applicationId, opinion);
    const consensus = mergeJudgeOpinions([opinion]);
    if (consensus) {
      await this.scoresService.upsertConsensus(applicationId, consensus);
    }
    return { consensus };
  }

  private persistOpinion(applicationId: string, opinion: JudgeOpinion) {
    return this.prisma.modelOpinion.upsert({
      where: {
        applicationId_provider: {
          applicationId,
          provider: opinion.provider,
        },
      },
      create: {
        applicationId,
        provider: opinion.provider,
        model: opinion.model,
        fitScore: opinion.fitScore,
        fitRationaleJson: (opinion.rationale ??
          Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        authenticitySignal:
          (opinion.authenticitySignal as AuthenticitySignal) ?? null,
        authenticityReasoning: opinion.authenticityReasoning,
        requirementChecksJson: (opinion.requirementChecks ??
          Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        error: null,
      },
      update: {
        model: opinion.model,
        fitScore: opinion.fitScore ?? null,
        fitRationaleJson: (opinion.rationale ??
          Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        authenticitySignal:
          (opinion.authenticitySignal as AuthenticitySignal) ?? null,
        authenticityReasoning: opinion.authenticityReasoning ?? null,
        requirementChecksJson: (opinion.requirementChecks ??
          Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        error: null,
      },
    });
  }
}
