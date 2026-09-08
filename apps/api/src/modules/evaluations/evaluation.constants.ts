export const EVALUATION_QUEUE_NAME = "evaluation-queue";

export const EVALUATION_JOB_TYPES = {
  EVALUATE_SUBMISSION: "evaluate-submission",
  EVALUATE_BATCH: "evaluate-batch",
} as const;

export const EVALUATION_STEPS = {
  FETCH_SUBMISSION: "fetch-submission",
  FETCH_GITHUB: "fetch-github",
  ANALYZE_CODE: "analyze-code",
  ANALYZE_DOCUMENTS: "analyze-documents",
  GENERATE_SCORES: "generate-scores",
  SAVE_RESULTS: "save-results",
} as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 5000, // Start with 5 seconds
  },
  removeOnComplete: {
    age: 24 * 60 * 60, // Keep completed jobs for 24 hours
    count: 1000, // Keep max 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
  },
};

export const AI_EVALUATION_CONFIG = {
  defaultModel: "gemini-1.5-flash",
  maxTokens: 4096,
  temperature: 0.3, // Lower temperature for more consistent scoring
  retryDelay: 1000,
  maxRetries: 3,
  rateLimitDelay: 500, // Delay between API calls to avoid rate limits
};
