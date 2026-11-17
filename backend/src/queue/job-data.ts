export interface UploadedResumeFile {
  originalName: string;
  path: string;
}

export interface IngestBatchJobData {
  batchId: string;
  uploads: UploadedResumeFile[];
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
