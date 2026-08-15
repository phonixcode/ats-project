import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
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
export class ClaudeProviderService implements LLMProvider {
  readonly name = 'claude' as const;
  readonly model = 'claude-3-5-haiku-20241022';
  private client: Anthropic | null = null;
  private cachedKey: string | null = null;

  constructor(private readonly settings: SettingsService) {}

  isConfigured(): boolean {
    return Boolean(this.settings.cloudKey('claude'));
  }

  private getClient(): Anthropic {
    const apiKey = this.settings.cloudKey('claude');
    if (!apiKey) {
      throw new Error('Claude isn’t set up');
    }
    if (!this.client || this.cachedKey !== apiKey) {
      this.client = new Anthropic({ apiKey });
      this.cachedKey = apiKey;
    }
    return this.client;
  }

  private async complete(system: string, user: string): Promise<string> {
    const response = await this.getClient().messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    if (!text) throw new Error('Claude didn’t return a read');
    return text;
  }

  async extractResumeData(resumeText: string): Promise<ExtractedResumeData> {
    const raw = await this.complete(EXTRACTION_PROMPT, resumeText);
    return parseJsonObject<ExtractedResumeData>(raw, 'Claude extraction');
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
      parseJsonObject<FitScoreResult>(raw, 'Claude scoring'),
    );
  }

  async assessAuthenticity(
    resumeText: string,
  ): Promise<AuthenticitySignalResult> {
    const raw = await this.complete(AUTHENTICITY_PROMPT, resumeText);
    return parseJsonObject<AuthenticitySignalResult>(
      raw,
      'Claude authenticity',
    );
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
      'Claude interview questions',
    );
    return parsed.questions;
  }
}
