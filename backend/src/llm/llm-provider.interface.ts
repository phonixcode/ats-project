export interface ExtractedResumeData {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  yearsOfExperience: number | null;
  education: { degree: string; institution: string }[];
  employmentGaps: string[];
  summary: string;
}

export interface JobPosting {
  title: string;
  description: string;
  location?: string | null;
  workplace?: string | null;
  employmentType?: string | null;
  seniority?: string | null;
  mustHaves: string[];
  niceToHaves: string[];
  skills: string[];
  minYears?: number | null;
  education?: string | null;
}

export interface RequirementCheck {
  requirement: string;
  kind: 'must_have' | 'nice_to_have';
  status: 'met' | 'partial' | 'missing';
}

export interface FitScoreResult {
  fitScore: number;
  rationale: {
    strengths: string[];
    gaps: string[];
    summary: string;
  };
  requirementChecks: RequirementCheck[];
}

export interface AuthenticitySignalResult {
  signal: 'NATURAL' | 'TEMPLATED' | 'UNCERTAIN';
  reasoning: string;
}

export interface InterviewQuestionResult {
  questionText: string;
  category:
    'VERIFY_CLAIM' | 'PROBE_GAP' | 'EXPLORE_STRENGTH' | 'AUTHENTICITY_CHECK';
  groundedIn: string;
}

export type ProviderName =
  'openai' | 'claude' | 'gemini' | 'local' | 'heuristic';

export interface LLMProvider {
  readonly name: ProviderName;
  readonly model: string;
  isConfigured(): boolean;
  extractResumeData(resumeText: string): Promise<ExtractedResumeData>;
  scoreFit(
    resumeData: ExtractedResumeData,
    posting: JobPosting,
  ): Promise<FitScoreResult>;
  assessAuthenticity(resumeText: string): Promise<AuthenticitySignalResult>;
  generateInterviewQuestions(
    resumeData: ExtractedResumeData,
    fitRationale: FitScoreResult['rationale'],
    authenticitySignal: 'NATURAL' | 'TEMPLATED' | 'UNCERTAIN',
  ): Promise<InterviewQuestionResult[]>;
}

export const FALLBACK_ORDER: ProviderName[] = [
  'local',
  'heuristic',
  'openai',
  'gemini',
  'claude',
];
