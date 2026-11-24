import { isPublicDeploymentAddress, deploymentUrl, inspectWarmupDeployment } from "./warmup-deployment";
import { lookup } from "dns/promises";
jest.mock("dns/promises", () => ({ lookup: jest.fn() }));
describe("Warmup deployment inspection", () => {
  it.each(["127.0.0.1", "10.1.2.3", "169.254.169.254", "172.16.1.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "198.18.1.2", "192.0.2.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "::1", "::ffff:127.0.0.1"])("blocks non-public address %s", address => expect(isPublicDeploymentAddress(address)).toBe(false));
  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34"])("accepts globally routed address %s", address => expect(isPublicDeploymentAddress(address)).toBe(true));
  it.each(["http://example.com", "https://user:password@example.com", "https://example.com:8443", "file:///tmp/test"])("rejects unsafe URL %s", url => expect(() => deploymentUrl(url)).toThrow());
  it("rejects mixed public/private DNS answers before making any request", async () => {
    (lookup as jest.Mock).mockResolvedValue([{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }]);
    await expect(inspectWarmupDeployment("https://example.com")).rejects.toThrow("public internet");
  });
});
