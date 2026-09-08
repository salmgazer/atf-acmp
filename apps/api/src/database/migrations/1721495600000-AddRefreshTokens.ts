import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokens1721495600000 implements MigrationInterface {
  name = "AddRefreshTokens1721495600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token" character varying NOT NULL,
        "userId" uuid NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "isRevoked" boolean NOT NULL DEFAULT false,
        "revokedAt" TIMESTAMP,
        "revokedReason" character varying,
        "userAgent" character varying,
        "ipAddress" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastUsedAt" TIMESTAMP,
        CONSTRAINT "UQ_refresh_tokens_token" UNIQUE ("token"),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_token" ON "refresh_tokens" ("token")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_user_revoked" ON "refresh_tokens" ("userId", "isRevoked")
    `);

    await queryRunner.query(`
      ALTER TABLE "refresh_tokens" 
      ADD CONSTRAINT "FK_refresh_tokens_user" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // Add passwordChangedAt column to users table
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordChangedAt"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_user_revoked"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_token"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
