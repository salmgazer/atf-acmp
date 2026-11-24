import { ConfigService } from "@nestjs/config";
import { GitHubService } from "./github.service";
describe("Runtime GitHub source access", () => {
  afterEach(() => jest.restoreAllMocks());
  const response = (status: number, data: unknown = {}) => ({ ok: status === 200, status, headers: new Headers(), json: async () => data }) as Response;
  it("falls back to public access after an expired credential and does not reuse that credential", async () => {
    const transport = jest.spyOn(global, "fetch").mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, { public: true })).mockResolvedValueOnce(response(200, { another: true }));
    const service = new GitHubService(new ConfigService({ GITHUB_TOKEN: "expired-test-only" }));
    expect(await (service as any).fetchGitHub("/repos/example/public")).toEqual({ public: true });
    await (service as any).fetchGitHub("/repos/example/another");
    expect((transport.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer expired-test-only");
    expect((transport.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect((transport.mock.calls[2][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
  });
  it("clears only the selected repository's evidence before a revised warmup review", async () => {
    const service = new GitHubService(new ConfigService());
    const transport = jest.spyOn(global, "fetch").mockResolvedValue(response(200, { version: 1 }));
    await (service as any).fetchGitHub("/repos/example/app"); await (service as any).fetchGitHub("/repos/example/app2");
    service.clearRepositoryCache("example", "app");
    await (service as any).fetchGitHub("/repos/example/app"); await (service as any).fetchGitHub("/repos/example/app2");
    expect(transport).toHaveBeenCalledTimes(3);
  });
});
