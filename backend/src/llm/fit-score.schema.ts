const stringList = { type: 'array', items: { type: 'string' } };

export const FIT_SCORE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['roleProfile', 'requirementChecks', 'rationale', 'fitScore'],
  properties: {
    roleProfile: { type: 'string' },
    requirementChecks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['requirement', 'kind', 'status'],
        properties: {
          requirement: { type: 'string' },
          kind: { type: 'string', enum: ['must_have', 'nice_to_have'] },
          status: { type: 'string', enum: ['met', 'partial', 'missing'] },
        },
      },
    },
    rationale: {
      type: 'object',
      additionalProperties: false,
      required: ['strengths', 'gaps', 'summary'],
      properties: {
        strengths: stringList,
        gaps: stringList,
        summary: { type: 'string' },
      },
    },
    fitScore: { type: 'integer' },
  },
};
