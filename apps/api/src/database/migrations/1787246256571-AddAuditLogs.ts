import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditLogs1787246256571 implements MigrationInterface {
    name = 'AddAuditLogs1787246256571'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_action_enum" AS ENUM('create', 'update', 'delete', 'login', 'logout', 'password_change', 'status_change', 'assignment', 'bulk_import', 'bulk_action')`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "actor_id" uuid, "actor_email" character varying, "action" "public"."audit_logs_action_enum" NOT NULL, "entity_type" character varying NOT NULL, "entity_id" character varying, "entity_name" character varying, "before" jsonb, "after" jsonb, "changes" jsonb, "description" character varying, "ip_address" character varying, "user_agent" character varying, "metadata" jsonb, CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_177183f29f438c488b5e8510cd" ON "audit_logs" ("actor_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ea9ba3dfb39050f831ee3be40d" ON "audit_logs" ("entity_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON "audit_logs" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_177183f29f438c488b5e8510cd" ON "audit_logs" ("actor_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7421efc125d95e413657efa3c6" ON "audit_logs" ("entity_type", "entity_id") `);
        await queryRunner.query(`ALTER TABLE "evaluations" ALTER COLUMN "ai_weight" SET DEFAULT '0.4'`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_177183f29f438c488b5e8510cdb" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_177183f29f438c488b5e8510cdb"`);
        await queryRunner.query(`ALTER TABLE "evaluations" ALTER COLUMN "ai_weight" SET DEFAULT 0.4`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7421efc125d95e413657efa3c6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_177183f29f438c488b5e8510cd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2cd10fda8276bb995288acfbfb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ea9ba3dfb39050f831ee3be40d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_177183f29f438c488b5e8510cd"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
    }

}
