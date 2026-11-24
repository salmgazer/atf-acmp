import { ConfigService } from "@nestjs/config";
import { GitHubService, GitHubTreeItem } from "./github.service";
describe("Language-neutral warmup source evidence", () => {
  const file = (path: string, size = 100): GitHubTreeItem => ({ path, size, type: "blob", sha: path });
  const service = () => {
    const github = new GitHubService(new ConfigService());
    jest.spyOn(github as any, "fetchGitHub").mockImplementation(async (...args: unknown[]) => ({ encoding: "base64", content: Buffer.from(String(args[0])).toString("base64") }));
    return github;
  };
  it.each(["php", "dart", "R", "sql", "kt", "swift", "ex", "vue", "svelte", "html"])("includes application source written in %s", async extension => {
    const result = await service().getSourceSamples("owner", "repo", [file(`src/app.${extension}`)]);
    expect(result).toHaveLength(1); expect(result[0]).toContain(`src/app.${extension}`);
  });
  it("prioritizes application code over configuration and tests without excluding files named builder", async () => {
    const result = await service().getSourceSamples("owner", "repo", [file("eslint.config.js"), file("vite.config.ts"), file("src/app.test.ts"), file("src/builder.ts"), file("src/Todo.tsx"), file("src/store.ts"), file("node_modules/dep/app.js"), file("dist/app.js"), file("src/oversized.ts", 60000)]);
    expect(result.map(value => value.split("\n")[0]).sort()).toEqual(["src/Todo.tsx", "src/builder.ts", "src/store.ts"].sort());
  });
  it("excludes vendored browser dependencies at every directory depth", async () => {
    const result = await service().getSourceSamples("owner", "repo", [file("bower_components/demo/src/app.js"), file("examples/old/bower_components/lib/src/index.js"), file("web_modules/src/index.js"), file("src/app.js")]);
    expect(result.map(value => value.split("\n")[0])).toEqual(["src/app.js"]);
  });
});
