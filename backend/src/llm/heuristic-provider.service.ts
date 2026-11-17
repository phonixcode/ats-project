import { Injectable } from '@nestjs/common';
import type {
  AuthenticitySignalResult,
  ExtractedResumeData,
  FitScoreResult,
  InterviewQuestionResult,
  JobPosting,
  LLMProvider,
} from './llm-provider.interface';
import {
  assessAuthenticityLocally,
  evaluateFitLocally,
  extractResumeLocally,
  generateQuestionsLocally,
} from './local-evaluator';

@Injectable()
export class HeuristicProviderService implements LLMProvider {
  readonly name = 'heuristic' as const;
  readonly model = 'local-evaluator';

  isConfigured(): boolean {
    return true;
  }

  async extractResumeData(resumeText: string): Promise<ExtractedResumeData> {
    return extractResumeLocally(resumeText);
  }

  async scoreFit(
    resumeData: ExtractedResumeData,
    resumeText: string,
    posting: JobPosting,
  ): Promise<FitScoreResult> {
    return evaluateFitLocally(resumeData, resumeText, posting);
  }

  async assessAuthenticity(
    resumeText: string,
  ): Promise<AuthenticitySignalResult> {
    return assessAuthenticityLocally(resumeText);
  }

  async generateInterviewQuestions(
    resumeData: ExtractedResumeData,
    fitRationale: FitScoreResult['rationale'],
    authenticitySignal: 'NATURAL' | 'TEMPLATED' | 'UNCERTAIN',
  ): Promise<InterviewQuestionResult[]> {
    return generateQuestionsLocally(
      resumeData,
      fitRationale,
      authenticitySignal,
    );
  }
}
