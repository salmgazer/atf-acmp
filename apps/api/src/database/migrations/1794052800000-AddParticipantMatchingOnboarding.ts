import { MigrationInterface, QueryRunner } from "typeorm";
export class AddParticipantMatchingOnboarding1794052800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE participants ADD COLUMN profile_confirmed_at timestamptz, ADD COLUMN github_account_status varchar(20)`);
    await q.query(`ALTER TABLE participant_preferences
      ADD COLUMN build_deploy_ability varchar(30), ADD COLUMN first_choice_sector varchar(50), ADD COLUMN backup_sector varchar(50), ADD COLUMN team_status varchar(30),
      ADD COLUMN matching_profile_consent boolean, ADD COLUMN matching_profile_consent_at timestamptz, ADD COLUMN matching_profile_consent_version varchar(30), ADD COLUMN matching_profile_completed_at timestamptz`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE participant_preferences DROP COLUMN build_deploy_ability, DROP COLUMN first_choice_sector, DROP COLUMN backup_sector, DROP COLUMN team_status,
      DROP COLUMN matching_profile_consent, DROP COLUMN matching_profile_consent_at, DROP COLUMN matching_profile_consent_version, DROP COLUMN matching_profile_completed_at`);
    await q.query(`ALTER TABLE participants DROP COLUMN profile_confirmed_at, DROP COLUMN github_account_status`);
  }
}
