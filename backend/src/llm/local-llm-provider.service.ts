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
  AUTHENTICITY_PROMPT,
  EXTRACTION_PROMPT,
  INTERVIEW_QUESTIONS_PROMPT,
  SCORING_PROMPT,
} from './prompts';
import { clampFitResult, parseJsonObject } from './parse-json';

@Injectable()
export class LocalLlmProviderService implements LLMProvider {
  readonly name = 'local' as const;
  readonly model = process.env.LOCAL_LLM_MODEL || 'llama3.2';
  private readonly baseUrl =
    process.env.LOCAL_LLM_URL || 'http://127.0.0.1:11434';

  isConfigured(): boolean {
    return process.env.LOCAL_LLM_ENABLED === 'true';
  }

  private async complete(system: string, user: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: 'json',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      },
    );
    if (!response.ok) {
      throw new Error('Local model did not return a read');
    }
    const payload = (await response.json()) as {
      message?: { content?: string };
    };
    const text = payload.message?.content;
    if (!text) throw new Error('Local model did not return a read');
    return text;
  }

  async extractResumeData(resumeText: string): Promise<ExtractedResumeData> {
    const raw = await this.complete(EXTRACTION_PROMPT, resumeText);
    return parseJsonObject<ExtractedResumeData>(raw, 'Local extraction');
  }

  async scoreFit(
    resumeData: ExtractedResumeData,
    posting: JobPosting,
  ): Promise<FitScoreResult> {
    const raw = await this.complete(
      SCORING_PROMPT,
      JSON.stringify({ candidate: resumeData, job: posting }),
    );
    return clampFitResult(
      parseJsonObject<FitScoreResult>(raw, 'Local scoring'),
    );
  }

  async assessAuthenticity(
    resumeText: string,
  ): Promise<AuthenticitySignalResult> {
    const raw = await this.complete(AUTHENTICITY_PROMPT, resumeText);
    return parseJsonObject<AuthenticitySignalResult>(raw, 'Local authenticity');
  }

  async generateInterviewQuestions(
    resumeData: ExtractedResumeData,
    fitRationale: FitScoreResult['rationale'],
    authenticitySignal: 'NATURAL' | 'TEMPLATED' | 'UNCERTAIN',
  ): Promise<InterviewQuestionResult[]> {
    const raw = await this.complete(
      INTERVIEW_QUESTIONS_PROMPT,
      JSON.stringify({
        candidate: resumeData,
        fitRationale,
        includeAuthenticityCheck: authenticitySignal !== 'NATURAL',
      }),
    );
    const parsed = parseJsonObject<{ questions: InterviewQuestionResult[] }>(
      raw,
      'Local interview questions',
    );
    return parsed.questions;
  }
}
