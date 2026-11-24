import { EvaluationProcessor } from "./evaluation.processor";
import { WarmupEvidenceError } from "./warmup-deployment";
describe("Warmup repository evidence boundaries", () => {
  function processor(error?: Error) {
    const github = { parseGitHubUrl: () => ({ owner: "example", repo: "warmup" }), clearRepositoryCache: jest.fn(), getRepositoryInfo: error ? jest.fn().mockRejectedValue(error) : jest.fn().mockResolvedValue({ isPrivate: true }), getRecentCommits: jest.fn() };
    return { value: Object.assign(Object.create(EvaluationProcessor.prototype), { githubService: github, logger: { warn: jest.fn() } }), github };
  }
  it("requires a public warmup repository before fetching any private source", async () => {
    const { value, github } = processor();
    await expect(value.analyzeGitHub("https://github.com/example/warmup", true)).rejects.toBeInstanceOf(WarmupEvidenceError);
    expect(github.clearRepositoryCache).toHaveBeenCalledWith("example", "warmup");
    expect(github.getRecentCommits).not.toHaveBeenCalled();
  });
  it("keeps temporary provider failures retryable instead of rejecting participants' work", async () => {
    const failure = new Error("GitHub API rate limit exceeded"); const { value } = processor(failure);
    await expect(value.analyzeGitHub("https://github.com/example/warmup", true)).rejects.toBe(failure);
  });
});
