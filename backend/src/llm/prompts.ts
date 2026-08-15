export const EXTRACTION_PROMPT = `You extract structured data from resumes. Respond with ONLY valid JSON, no markdown, no preamble, matching exactly this shape:
{
  "name": string or null,
  "email": string or null,
  "phone": string or null,
  "skills": string[],
  "yearsOfExperience": number or null (estimate total professional years),
  "education": [{ "degree": string, "institution": string }],
  "employmentGaps": string[] (describe any gaps you notice, e.g. "8 month gap between 2021-2022 roles"),
  "summary": string (2-3 sentence neutral summary of their background)
}`;

export const SCORING_PROMPT = `You evaluate how well a candidate fits a job posting. The posting description is the source of truth — it includes what the role is and who they need. If a structured must-have list is empty, pull hard requirements from that description. Be fair and give benefit of the doubt: missing a nice-to-have is not disqualifying, and unconventional backgrounds can still be strong fits. A missing must-have is a hard miss.

Respond with ONLY valid JSON:
{
  "fitScore": number (0-100),
  "rationale": {
    "strengths": string[] (specific, grounded in their actual background),
    "gaps": string[] (specific missing requirements — phrase neutrally, not as failures),
    "summary": string (2-3 sentences, balanced)
  },
  "requirementChecks": [
    {
      "requirement": string (the must-have or nice-to-have you checked),
      "kind": "must_have" | "nice_to_have",
      "status": "met" | "partial" | "missing"
    }
  ]
}`;

export const AUTHENTICITY_PROMPT = `You assess whether resume text reads as personally written or as generic/templated AI output. Be conservative — natural variation, non-native English phrasing, and concise writing are NOT signs of AI generation. Only flag "TEMPLATED" for genuinely generic, buzzword-heavy text with no specific detail. When unsure, say UNCERTAIN. Respond with ONLY valid JSON:
{
  "signal": "NATURAL" | "TEMPLATED" | "UNCERTAIN",
  "reasoning": string (specific, point to what led to this read)
}`;

export const INTERVIEW_QUESTIONS_PROMPT = `You write interview questions for a specific candidate based on their actual resume. Every question must reference something concrete from their background — never generic questions like "tell me about yourself." Generate exactly 4 questions:
1. VERIFY_CLAIM — pick a specific skill or achievement they listed and ask them to walk through a real instance of it.
2. PROBE_GAP — pick something the fit rationale flagged as missing or thin, and turn it into a fair, non-accusatory question giving them room to explain.
3. EXPLORE_STRENGTH — pick their strongest, most specific point and ask a harder-than-surface follow-up question about it.
4. AUTHENTICITY_CHECK — only include this if instructed below; otherwise generate a second EXPLORE_STRENGTH or PROBE_GAP question instead.

Respond with ONLY valid JSON:
{
  "questions": [
    { "questionText": string, "category": "VERIFY_CLAIM" | "PROBE_GAP" | "EXPLORE_STRENGTH" | "AUTHENTICITY_CHECK", "groundedIn": string (the specific resume detail this targets) }
  ]
}`;
