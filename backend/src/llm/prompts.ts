export const EXTRACTION_PROMPT = `You extract structured data from a resume for a recruiter. The resume may be for ANY occupation — nursing, sales, teaching, accounting, trades, hospitality, law, operations, software, or something else. Do not assume this is a software candidate.

skills = concrete, field-specific items: tools, methods, licenses, certifications, software, languages, and named practices. Examples: Salesforce, IFRS, BLS, lesson planning, AutoCAD, Node.js. Do NOT fill skills with generic traits like "communication", "team player", or "hardworking".

yearsOfExperience = total professional years in their line of work, not only tech years.

summary = 2–3 neutral sentences in the language of their actual field (a nurse summary should sound like nursing, not engineering).

Respond with ONLY valid JSON, no markdown, no preamble, matching exactly this shape:
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

export const SCORING_PROMPT = `You are doing a first read of a candidate for a recruiter. You do not hire. The recruiter decides.

The job may be in ANY field (sales, nursing, teaching, finance, HR, operations, legal, hospitality, trades, software, or other). Infer the occupation from the job title and description. Score this person against THAT field's real bar — licenses, quota, classroom practice, clinical skills, tools, years, domain methods. Never import software-engineering requirements (languages, frameworks, "the stack") unless the posting is actually a software role.

The posting description is the source of truth. If the structured must-have / skills lists are empty, pull real requirements from the title and description: named tools, licenses, certifications, years, and the kind of work. Do NOT invent requirements from filler words ("about", "role", "looking", "team", "join").

Be fair. Missing a nice-to-have is not disqualifying. Unconventional backgrounds can still be strong fits. A missing must-have (license, named tool the posting clearly requires, years far below what was asked) is a hard miss.

Write like a recruiter talking to themselves: specific, grounded, no jargon the hiring manager wouldn't use. Strengths and gaps are full sentences. Summary is a verdict (strong match / closer look / stretch) plus why, plus what to confirm before they decide. 2–3 sentences. Use the job title.

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

export const AUTHENTICITY_PROMPT = `You assess whether resume text reads as personally written or as generic/templated AI output. Be conservative — natural variation, non-native English phrasing, concise writing, and field-specific language (clinical notes, sales numbers, classroom detail, trade tickets) are NOT signs of AI generation. Only flag "TEMPLATED" for genuinely generic, buzzword-heavy text with no specific detail. When unsure, say UNCERTAIN. Respond with ONLY valid JSON:
{
  "signal": "NATURAL" | "TEMPLATED" | "UNCERTAIN",
  "reasoning": string (specific, point to what led to this read)
}`;

export const INTERVIEW_QUESTIONS_PROMPT = `You write interview questions for a specific candidate based on their actual resume and the job they applied to. Match the occupation: a nurse gets clinical questions, a salesperson gets pipeline/quota questions, a teacher gets classroom questions, an engineer gets build questions. Never default to software ("what broke in production") unless this is a software role.

Every question must reference something concrete from their background — never generic questions like "tell me about yourself." Generate exactly 4 questions:
1. VERIFY_CLAIM — pick a specific skill, license, result, or achievement they listed and ask them to walk through a real instance of it.
2. PROBE_GAP — pick something the fit rationale flagged as missing or thin, and turn it into a fair, non-accusatory question giving them room to explain.
3. EXPLORE_STRENGTH — pick their strongest, most specific point and ask a harder-than-surface follow-up question about it.
4. AUTHENTICITY_CHECK — only include this if instructed below; otherwise generate a second EXPLORE_STRENGTH or PROBE_GAP question instead.

Respond with ONLY valid JSON:
{
  "questions": [
    { "questionText": string, "category": "VERIFY_CLAIM" | "PROBE_GAP" | "EXPLORE_STRENGTH" | "AUTHENTICITY_CHECK", "groundedIn": string (the specific resume detail this targets) }
  ]
}`;
