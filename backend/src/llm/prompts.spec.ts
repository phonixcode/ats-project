import {
  AUTHENTICITY_PROMPT,
  EXTRACTION_PROMPT,
  INTERVIEW_QUESTIONS_PROMPT,
  SCORING_PROMPT,
} from './prompts';

describe('cloud reader prompts', () => {
  it('tells extraction and scoring this is not a software-only ATS', () => {
    expect(EXTRACTION_PROMPT).toMatch(/any occupation/i);
    expect(EXTRACTION_PROMPT).toMatch(/nursing|sales|teaching/i);
    expect(SCORING_PROMPT).toMatch(/any field/i);
    expect(SCORING_PROMPT).toMatch(
      /never import software-engineering requirements/i,
    );
    expect(SCORING_PROMPT).toMatch(/licenses|quota|classroom|clinical/i);
  });

  it('keeps the JSON contracts the providers parse', () => {
    expect(EXTRACTION_PROMPT).toContain('"skills": string[]');
    expect(SCORING_PROMPT).toContain('"fitScore": number (0-100)');
    expect(SCORING_PROMPT).toContain('"kind": "must_have" | "nice_to_have"');
    expect(AUTHENTICITY_PROMPT).toContain(
      '"signal": "NATURAL" | "TEMPLATED" | "UNCERTAIN"',
    );
    expect(INTERVIEW_QUESTIONS_PROMPT).toContain('VERIFY_CLAIM');
  });

  it('asks interview questions in the language of the job', () => {
    expect(INTERVIEW_QUESTIONS_PROMPT).toMatch(/match the occupation/i);
    expect(INTERVIEW_QUESTIONS_PROMPT).not.toMatch(
      /walk through a real project where you used/i,
    );
  });
});
