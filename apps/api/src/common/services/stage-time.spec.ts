import { parseStageTimestamp } from "./stage-time";
describe("UTC stage timestamps", () => {
  it("interprets the editor's offset-free input as UTC and respects explicit offsets", () => {
    expect(parseStageTimestamp("2031-09-13T18:15").toISOString()).toBe("2031-09-13T18:15:00.000Z");
    expect(parseStageTimestamp("2031-09-13T21:15:00+03:00").toISOString()).toBe("2031-09-13T18:15:00.000Z");
    expect(parseStageTimestamp("2031-09-13").toISOString()).toBe("2031-09-13T00:00:00.000Z");
    expect(() => parseStageTimestamp("invalid")).toThrow("valid ISO");
  });
});
