import { INestApplication } from "@nestjs/common";
import { json } from "express";

export function configureBodyParsers(app: INestApplication) {
  // Larger CSV payloads are accepted only by the submission importer.
  app.use("/api/organizations/submission-import", json({ limit: "2mb" }));
  app.use("/api/participants/import", json({ limit: "3mb" }));
  // Nest detects the route-specific jsonParser and skips its default parser.
  // Register the default explicitly so every other route still receives JSON.
  app.use(json());
}
