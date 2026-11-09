import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { SUBMISSION_UPDATE_FIELDS } from "@acmp/shared";

describe("Development API runtime resolution", () => {
  it("loads shared definitions and API aliases from the current Nest compilation instead of stale package builds", () => {
    const apiRoot = path.resolve(__dirname, "..");
    const devCommand = JSON.parse(readFileSync(path.join(apiRoot, "package.json"), "utf8")).scripts.dev as string;
    const runtimeBase = /^TS_NODE_BASEURL=(\S+) /.exec(devCommand)?.[1];
    expect(runtimeBase).toBe("./dist/apps/api");
    const fixture = mkdtempSync(path.join(tmpdir(), "acmp-development-runtime-"));
    try {
      const api = path.join(fixture, "apps/api"), shared = path.join(api, "dist/packages/shared/src");
      const stale = path.join(fixture, "node_modules/@acmp/shared");
      for (const directory of [shared, stale, path.join(api, "dist/apps/api/src")]) mkdirSync(directory, { recursive: true });
      writeFileSync(path.join(api, "tsconfig.json"), readFileSync(path.join(apiRoot, "tsconfig.json")));
      writeFileSync(path.join(shared, "index.js"), `module.exports = { fields: ${JSON.stringify(SUBMISSION_UPDATE_FIELDS.map(field => field.key))} };`);
      writeFileSync(path.join(stale, "package.json"), JSON.stringify({ main: "index.js" }));
      writeFileSync(path.join(stale, "index.js"), 'module.exports = { fields: ["industry"] };');
      writeFileSync(path.join(api, "dist/apps/api/src/probe.js"), 'module.exports = "current-api-compilation";');
      const result = spawnSync(process.execPath, ["-r", require.resolve("tsconfig-paths/register"), "-e",
        'console.log(JSON.stringify({ fields: require("@acmp/shared").fields, probe: require("@/probe") }))'], {
        cwd: api, encoding: "utf8", env: { ...process.env, TS_NODE_BASEURL: runtimeBase, TS_NODE_PROJECT: path.join(api, "tsconfig.json") },
      });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ fields: SUBMISSION_UPDATE_FIELDS.map(field => field.key), probe: "current-api-compilation" });
      expect(JSON.parse(result.stdout).fields).toContain("verticalId");
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
