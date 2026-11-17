import OpenAI from 'openai';
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
  scoringInput,
} from './prompts';
import { clampFitResult, parseJsonObject } from './parse-json';
import { FIT_SCORE_JSON_SCHEMA } from './fit-score.schema';

@Injectable()
export class OpenAiProviderService implements LLMProvider {
  readonly name = 'openai' as const;
  readonly model = 'gpt-5.4-mini';
  private client: OpenAI | null = null;
  private cachedKey: string | null = null;

  constructor(private readonly settings: SettingsService) {}

  isConfigured(): boolean {
    return Boolean(this.settings.cloudKey('openai'));
  }

  private getClient(): OpenAI {
    const apiKey = this.settings.cloudKey('openai');
    if (!apiKey) {
      throw new Error('OpenAI isn’t set up');
    }
    if (!this.client || this.cachedKey !== apiKey) {
      this.client = new OpenAI({ apiKey });
      this.cachedKey = apiKey;
    }
    return this.client;
  }

  async extractResumeData(resumeText: string): Promise<ExtractedResumeData> {
    const response = await this.getClient().chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: resumeText },
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('OpenAI didn’t return a read');
    return parseJsonObject<ExtractedResumeData>(raw, 'OpenAI extraction');
  }

  async scoreFit(
    resumeData: ExtractedResumeData,
    resumeText: string,
    posting: JobPosting,
  ): Promise<FitScoreResult> {
    const response = await this.getClient().chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: SCORING_PROMPT },
        {
          role: 'user',
          content: scoringInput(resumeData, resumeText, posting),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'fit_score',
          strict: true,
          schema: FIT_SCORE_JSON_SCHEMA,
        },
      },
      reasoning_effort: 'low',
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('OpenAI didn’t return a read');
    return clampFitResult(
      parseJsonObject<FitScoreResult>(raw, 'OpenAI scoring'),
    );
  }

  async assessAuthenticity(
    resumeText: string,
  ): Promise<AuthenticitySignalResult> {
    const response = await this.getClient().chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: AUTHENTICITY_PROMPT },
        { role: 'user', content: resumeText },
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('OpenAI didn’t return a read');
    return parseJsonObject<AuthenticitySignalResult>(
      raw,
      'OpenAI authenticity',
    );
  }

  async generateInterviewQuestions(
    resumeData: ExtractedResumeData,
    fitRationale: FitScoreResult['rationale'],
    authenticitySignal: 'NATURAL' | 'TEMPLATED' | 'UNCERTAIN',
  ): Promise<InterviewQuestionResult[]> {
    const includeAuthCheck = authenticitySignal !== 'NATURAL';
    const response = await this.getClient().chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: INTERVIEW_QUESTIONS_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            candidate: resumeData,
            fitRationale,
            includeAuthenticityCheck: includeAuthCheck,
          }),
        },
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('OpenAI didn’t return a read');
    const parsed = parseJsonObject<{ questions: InterviewQuestionResult[] }>(
      raw,
      'OpenAI interview questions',
    );
    return parsed.questions;
  }
}
