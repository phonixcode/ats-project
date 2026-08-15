import { GoogleGenerativeAI } from '@google/generative-ai';
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
export class GeminiProviderService implements LLMProvider {
  readonly name = 'gemini' as const;
  readonly model = 'gemini-2.0-flash';
  private client: GoogleGenerativeAI | null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  private getModel() {
    if (!this.client) {
      throw new Error('Gemini isn’t set up');
    }
    return this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });
  }

  private async complete(system: string, user: string): Promise<string> {
    const result = await this.getModel().generateContent({
      systemInstruction: system,
      contents: [{ role: 'user', parts: [{ text: user }] }],
    });
    const text = result.response.text();
    if (!text) throw new Error('Gemini didn’t return a read');
    return text;
  }

  async extractResumeData(resumeText: string): Promise<ExtractedResumeData> {
    const raw = await this.complete(EXTRACTION_PROMPT, resumeText);
    return parseJsonObject<ExtractedResumeData>(raw, 'Gemini extraction');
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
      parseJsonObject<FitScoreResult>(raw, 'Gemini scoring'),
    );
  }

  async assessAuthenticity(
    resumeText: string,
  ): Promise<AuthenticitySignalResult> {
    const raw = await this.complete(AUTHENTICITY_PROMPT, resumeText);
    return parseJsonObject<AuthenticitySignalResult>(
      raw,
      'Gemini authenticity',
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
      'Gemini interview questions',
    );
    return parsed.questions;
  }
}
