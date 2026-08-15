import OpenAI from 'openai';
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
export class OpenAiProviderService implements LLMProvider {
  readonly name = 'openai' as const;
  readonly model = 'gpt-4o-mini';
  private client: OpenAI | null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      throw new Error('OpenAI isn’t set up');
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
      temperature: 0,
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('OpenAI didn’t return a read');
    return parseJsonObject<ExtractedResumeData>(raw, 'OpenAI extraction');
  }

  async scoreFit(
    resumeData: ExtractedResumeData,
    posting: JobPosting,
  ): Promise<FitScoreResult> {
    const response = await this.getClient().chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: SCORING_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({ candidate: resumeData, job: posting }),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
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
      temperature: 0,
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
      temperature: 0.3,
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
