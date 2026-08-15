import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRegistryService } from '../llm/provider-registry.service';
import { QuestionCategory } from '@prisma/client';
import type { ExtractedResumeData } from '../llm/llm-provider.interface';

@Injectable()
export class InterviewQuestionsService {
  constructor(
    private prisma: PrismaService,
    private registry: ProviderRegistryService,
  ) {}

  async generateForApplication(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { score: true },
    });

    if (!application)
      throw new NotFoundException(`Application ${applicationId} not found`);
    if (!application.parsedJson) {
      throw new Error(
        'Cannot generate interview questions before extraction has completed',
      );
    }

    const questions = await this.registry.runWithFallback((provider) =>
      provider.generateInterviewQuestions(
        application.parsedJson as unknown as ExtractedResumeData,
        (application.score?.fitRationaleJson as any) ?? {
          strengths: [],
          gaps: [],
          summary: '',
        },
        application.score?.authenticitySignal ?? 'UNCERTAIN',
      ),
    );

    await this.prisma.interviewQuestion.deleteMany({
      where: { applicationId },
    });

    return this.prisma.$transaction(
      questions.map((q) =>
        this.prisma.interviewQuestion.create({
          data: {
            applicationId,
            questionText: q.questionText,
            category: q.category as QuestionCategory,
            groundedIn: q.groundedIn,
          },
        }),
      ),
    );
  }

  findByApplication(applicationId: string) {
    return this.prisma.interviewQuestion.findMany({ where: { applicationId } });
  }
}
