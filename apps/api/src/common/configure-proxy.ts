import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isIP } from "net";

/** Trust only the immediate ALB peer, and only from explicitly configured subnets. */
export function configureProxy(app: INestApplication, config: ConfigService): void {
  const entries = (config.get<string>("TRUST_PROXY_CIDRS") || "").split(",").map(value => value.trim()).filter(Boolean);
  if (!entries.length && ["staging", "production"].includes(config.get<string>("NODE_ENV") || "")) {
    throw new Error("TRUST_PROXY_CIDRS must identify the load balancer subnets in staging/production");
  }
  for (const entry of entries) {
    const [address, prefix, ...extra] = entry.split("/");
    const version = isIP(address);
    if (!version || extra.length || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (version === 4 ? 32 : 128)))) {
      throw new Error("TRUST_PROXY_CIDRS must contain explicit IP addresses or non-global CIDRs");
    }
  }
  const express = app.getHttpAdapter().getInstance();
  express.set("trust proxy", entries.length ? entries : false);
  if (entries.length) {
    const inTrustedSubnet = express.get("trust proxy fn") as (ip: string) => boolean;
    express.set("trust proxy", (ip: string, hop: number) => hop === 0 && inTrustedSubnet(ip));
  }
}
