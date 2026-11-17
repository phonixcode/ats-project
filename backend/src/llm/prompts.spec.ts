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

describe('hiring company context', () => {
  it('judges every role as hired into Morgen Green without making non-tech roles technical', () => {
    expect(SCORING_PROMPT).toMatch(/hiring company is Morgen Green Limited/);
    expect(SCORING_PROMPT).toMatch(/non-technical roles stay non-technical/i);
    expect(SCORING_PROMPT).toMatch(/Nigeria Data Protection Act/);
    expect(INTERVIEW_QUESTIONS_PROMPT).toMatch(/hiring company is Morgen Green Limited/);
    expect(SCORING_PROMPT).not.toContain('${');
  });

  it('does not filter on certificates or location, and keeps client names out', () => {
    expect(SCORING_PROMPT).toMatch(/does not hire on certificates/i);
    expect(SCORING_PROMPT).toMatch(/no location bias/i);
    expect(SCORING_PROMPT).toMatch(/must come from the posting/i);
    expect(SCORING_PROMPT).toMatch(/never flag what the resume shows by implication/i);
    expect(SCORING_PROMPT).toMatch(/score precisely/i);
    for (const prompt of [SCORING_PROMPT, INTERVIEW_QUESTIONS_PROMPT]) {
      expect(prompt).not.toMatch(/JAMB|NECO|JUPEB/);
    }
  });
});
