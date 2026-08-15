export interface ExtractArchiveJobData {
  batchId: string;
  zipPath: string;
}

export interface ParseResumeJobData {
  applicationId: string;
  candidateId: string;
  filePath: string;
  batchId?: string;
}

export interface ExtractJobData {
  applicationId: string;
  candidateId: string;
  resumeText: string;
  batchId?: string;
}

export interface ScoringJobData {
  applicationId: string;
  batchId?: string;
}
