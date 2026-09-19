import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
} from "@google/generative-ai";
import { AI_EVALUATION_CONFIG } from "./evaluation.constants";
import { AIScoreResult, EvaluationMetrics } from "@/database/entities/evaluation.entity";

export interface EvaluationRubric {
  criteria: Array<{
    id: string;
    name: string;
    description: string;
    maxScore: number;
    weight: number;
  }>;
}

export interface SubmissionData {
  teamName: string;
  projectName?: string;
  stageNumber: number;
  stageName: string;
  documents?: Array<{
    name: string;
    content: string;
    type: string;
  }>;
  githubUrl?: string;
  videoUrl?: string;
  additionalContent?: Record<string, string>;
}

export interface CodeAnalysisData {
  repoUrl: string;
  languages: string[];
  fileCount: number;
  totalLines: number;
  commits: Array<{
    message: string;
    date: string;
    author: string;
  }>;
  readmeContent?: string;
  sampleCode?: string[];
  structure?: string;
}

export interface GeminiEvaluationResult {
  scores: AIScoreResult[];
  overallScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  confidence: number;
  tokensUsed: number;
}

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private isConfigured = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>("GEMINI_API_KEY");
    if (!apiKey) {
      this.logger.warn("GEMINI_API_KEY not configured - AI evaluation disabled");
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: AI_EVALUATION_CONFIG.defaultModel,
    });
    this.isConfigured = true;
    this.logger.log("Gemini AI service initialized");
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  private getGenerationConfig(): GenerationConfig {
    return {
      temperature: AI_EVALUATION_CONFIG.temperature,
      maxOutputTokens: AI_EVALUATION_CONFIG.maxTokens,
      responseMimeType: "application/json",
    };
  }


  /**
   * Evaluate a submission using the provided rubric
   */
  async evaluateSubmission(
    submission: SubmissionData,
    rubric: EvaluationRubric,
    codeAnalysis?: CodeAnalysisData,
  ): Promise<GeminiEvaluationResult> {
    if (!this.isConfigured) {
      throw new Error("Gemini AI service not configured");
    }

    const prompt = this.buildSubmissionEvaluationPrompt(submission, rubric, codeAnalysis);

    try {
      const result = await this.callGeminiWithRetry(prompt);
      return this.parseEvaluationResponse(result, rubric);
    } catch (error) {
      this.logger.error("Failed to evaluate submission", error);
      throw error;
    }
  }

  /**
   * Analyze code repository quality
   */
  async analyzeCodeQuality(codeData: CodeAnalysisData): Promise<EvaluationMetrics> {
    if (!this.isConfigured) {
      throw new Error("Gemini AI service not configured");
    }

    const prompt = this.buildCodeAnalysisPrompt(codeData);

    try {
      const result = await this.callGeminiWithRetry(prompt);
      return this.parseCodeAnalysisResponse(result);
    } catch (error) {
      this.logger.error("Failed to analyze code", error);
      throw error;
    }
  }

  private buildSubmissionEvaluationPrompt(
    submission: SubmissionData,
    rubric: EvaluationRubric,
    codeAnalysis?: CodeAnalysisData,
  ): string {
    const rubricText = rubric.criteria
      .map(
        (c) =>
          `- ${c.name} (${c.weight}% weight, max ${c.maxScore} points): ${c.description}`,
      )
      .join("\n");

    // DEMO MODE: Focus on code only
    // const documentsText = submission.documents
    //   ?.map((d) => `### ${d.name} (${d.type})\n${d.content}`)
    //   .join("\n\n") || "No documents provided";

    const codeText = codeAnalysis
      ? `
### Code Repository Analysis
- Repository: ${codeAnalysis.repoUrl}
- Languages: ${codeAnalysis.languages.join(", ")}
- Files: ${codeAnalysis.fileCount}, Lines: ${codeAnalysis.totalLines}
- Recent Commits: ${codeAnalysis.commits.length}
${codeAnalysis.readmeContent ? `\n### README\n${codeAnalysis.readmeContent.slice(0, 2000)}` : ""}
${codeAnalysis.structure ? `\n### Project Structure\n${codeAnalysis.structure}` : ""}
${codeAnalysis.sampleCode?.length ? `\n### Sample Code\n${codeAnalysis.sampleCode.slice(0, 3).join("\n\n---\n\n")}` : ""}
`
      : "No code repository provided";

    return `You are an expert evaluator for an innovation challenge program. Evaluate the following team's code submission for Stage ${submission.stageNumber}: ${submission.stageName}.

## Team Information
- Team Name: ${submission.teamName}
${submission.projectName ? `- Project: ${submission.projectName}` : ""}

## Evaluation Rubric
${rubricText}

## Code Submission
${codeText}

## Instructions
Evaluate this code submission against each criterion in the rubric. Focus on:
- Code quality and organization
- Technical implementation
- Innovation in approach
- Documentation and README quality
- Commit history and development practices

Be fair, constructive, and specific in your feedback.

Return a JSON object with this exact structure:
{
  "scores": [
    {
      "criterionId": "string",
      "criterionName": "string",
      "score": number,
      "maxScore": number,
      "explanation": "string (2-3 sentences explaining the score)",
      "confidence": number (0.0-1.0)
    }
  ],
  "overallFeedback": "string (comprehensive feedback paragraph)",
  "strengths": ["string array of 3-5 key strengths"],
  "improvements": ["string array of 3-5 areas for improvement"],
  "overallConfidence": number (0.0-1.0)
}

Be objective and consistent. Score based on evidence in the code repository.`;
  }


  private buildCodeAnalysisPrompt(codeData: CodeAnalysisData): string {
    const commitsText = codeData.commits
      .slice(0, 20)
      .map((c) => `- ${c.date}: ${c.message} (${c.author})`)
      .join("\n");

    return `You are a senior software engineer reviewing a project repository. Analyze the following codebase:

## Repository Information
- URL: ${codeData.repoUrl}
- Languages: ${codeData.languages.join(", ")}
- Total Files: ${codeData.fileCount}
- Total Lines: ${codeData.totalLines}

## Recent Commit History
${commitsText}

${codeData.readmeContent ? `## README Content\n${codeData.readmeContent.slice(0, 3000)}` : "## README: Not found"}

${codeData.structure ? `## Project Structure\n${codeData.structure}` : ""}

${codeData.sampleCode?.length ? `## Sample Code Files\n${codeData.sampleCode.slice(0, 5).join("\n\n---\n\n")}` : ""}

## Instructions
Analyze this codebase for quality, organization, and best practices.

Return a JSON object with this exact structure:
{
  "codeQuality": {
    "score": number (0-100),
    "issues": ["string array of code quality issues found"],
    "strengths": ["string array of code quality strengths"]
  },
  "commitHistory": {
    "totalCommits": number,
    "contributors": number,
    "commitFrequency": "string (e.g., 'Regular', 'Sporadic', 'Burst')",
    "score": number (0-100),
    "assessment": "string (brief assessment of commit practices)"
  },
  "documentation": {
    "hasReadme": boolean,
    "readmeQuality": number (0-100),
    "codeComments": number (0-100 estimate),
    "assessment": "string"
  },
  "architecture": {
    "score": number (0-100),
    "assessment": "string"
  },
  "overallAssessment": "string (2-3 sentence summary)"
}`;
  }

  private async callGeminiWithRetry(prompt: string, maxRetries = 3): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: this.getGenerationConfig(),
        });

        const response = result.response;
        const text = response.text();

        if (!text) {
          throw new Error("Empty response from Gemini");
        }

        return text;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `Gemini API call failed (attempt ${attempt}/${maxRetries}): ${error.message}`,
        );

        if (attempt < maxRetries) {
          // Check for rate limiting
          if (error.message?.includes("429") || error.message?.includes("rate")) {
            await this.delay(AI_EVALUATION_CONFIG.retryDelay * attempt * 2);
          } else {
            await this.delay(AI_EVALUATION_CONFIG.retryDelay * attempt);
          }
        }
      }
    }

    throw lastError || new Error("Failed to get response from Gemini");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }


  private parseEvaluationResponse(
    responseText: string,
    rubric: EvaluationRubric,
  ): GeminiEvaluationResult {
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.slice(7);
      }
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith("```")) {
        cleanedText = cleanedText.slice(0, -3);
      }

      const parsed = JSON.parse(cleanedText.trim());

      // Map scores to our format
      const scores: AIScoreResult[] = parsed.scores.map((s: any) => ({
        criterionId: s.criterionId,
        criterionName: s.criterionName,
        score: Number(s.score),
        maxScore: Number(s.maxScore),
        explanation: s.explanation || "",
        confidence: Number(s.confidence) || 0.8,
      }));

      // Calculate weighted overall score
      let totalWeightedScore = 0;
      let totalWeight = 0;

      for (const score of scores) {
        const criterion = rubric.criteria.find((c) => c.id === score.criterionId);
        if (criterion) {
          const normalizedScore = (score.score / score.maxScore) * 100;
          totalWeightedScore += normalizedScore * criterion.weight;
          totalWeight += criterion.weight;
        }
      }

      const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

      // Estimate tokens used (rough approximation)
      const tokensUsed = Math.ceil(
        (responseText.length + cleanedText.length) / 4,
      );

      return {
        scores,
        overallScore: Math.round(overallScore * 100) / 100,
        feedback: parsed.overallFeedback || "",
        strengths: parsed.strengths || [],
        improvements: parsed.improvements || [],
        confidence: Number(parsed.overallConfidence) || 0.8,
        tokensUsed,
      };
    } catch (error) {
      this.logger.error("Failed to parse evaluation response", {
        error,
        responseText: responseText.slice(0, 500),
      });
      throw new Error("Failed to parse AI evaluation response");
    }
  }

  private parseCodeAnalysisResponse(responseText: string): EvaluationMetrics {
    try {
      // Clean the response
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.slice(7);
      }
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith("```")) {
        cleanedText = cleanedText.slice(0, -3);
      }

      const parsed = JSON.parse(cleanedText.trim());

      return {
        codeQuality: {
          score: Number(parsed.codeQuality?.score) || 0,
          issues: parsed.codeQuality?.issues || [],
          strengths: parsed.codeQuality?.strengths || [],
        },
        commitHistory: {
          totalCommits: Number(parsed.commitHistory?.totalCommits) || 0,
          contributors: Number(parsed.commitHistory?.contributors) || 0,
          commitFrequency: parsed.commitHistory?.commitFrequency || "Unknown",
          score: Number(parsed.commitHistory?.score) || 0,
        },
        documentation: {
          hasReadme: Boolean(parsed.documentation?.hasReadme),
          readmeQuality: Number(parsed.documentation?.readmeQuality) || 0,
          codeComments: Number(parsed.documentation?.codeComments) || 0,
        },
        tokensUsed: Math.ceil((responseText.length + cleanedText.length) / 4),
      };
    } catch (error) {
      this.logger.error("Failed to parse code analysis response", {
        error,
        responseText: responseText.slice(0, 500),
      });
      throw new Error("Failed to parse AI code analysis response");
    }
  }

  /**
   * Estimate cost based on tokens used
   * Pricing as of 2024 for Gemini 1.5 Flash
   */
  estimateCost(tokensUsed: number): number {
    // Approximate pricing: $0.00001875 per 1K input tokens, $0.000075 per 1K output tokens
    // Using average estimate
    const costPer1KTokens = 0.00005;
    return (tokensUsed / 1000) * costPer1KTokens;
  }
}
