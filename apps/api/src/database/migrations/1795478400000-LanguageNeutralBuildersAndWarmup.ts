import { MigrationInterface, QueryRunner } from "typeorm";
export class LanguageNeutralBuildersAndWarmup1795478400000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE participants ADD COLUMN preferred_language varchar, ADD COLUMN other_language varchar,
      ADD COLUMN language_proficiency varchar, ADD COLUMN development_experience boolean, ADD COLUMN testing_experience boolean,
      ADD COLUMN deployment_experience boolean, ADD COLUMN builder_confirm boolean NOT NULL DEFAULT false`);
    // This is the exact previous qualification rule. Confirmation never removes migration eligibility.
    await q.query(`UPDATE participants p SET development_experience=true, testing_experience=true, deployment_experience=true,
      preferred_language=CASE WHEN trim(coalesce(p.python_skill,'')) ~* '^(intermediate|advanced|expert)\\y' THEN 'Python' ELSE NULL END,
      language_proficiency=CASE WHEN trim(coalesce(p.python_skill,'')) ~* '^intermediate\\y' THEN 'Intermediate' WHEN trim(coalesce(p.python_skill,'')) ~* '^advanced\\y' THEN 'Advanced' WHEN trim(coalesce(p.python_skill,'')) ~* '^expert\\y' THEN 'Expert' ELSE NULL END
      WHERE p.code_labs_completed=true OR (trim(coalesce(p.python_skill,'')) ~* '^(intermediate|advanced|expert)\\y'
        AND EXISTS(SELECT 1 FROM participant_preferences pref WHERE pref.participant_id=p.id AND pref.deleted_at IS NULL AND pref.build_deploy_ability='confident'))`);
    // Frozen aliases reflect the original skill tags, including combined language families.
    // A single language is a prefill. Multiple languages require the participant to choose.
    // Python proficiency stays with Python and is never transferred to another language.
    const aliases = {"python": ["Python"], "javascript": ["JavaScript"], "js": ["JavaScript"], "typescript": ["TypeScript"], "ts": ["TypeScript"], "javascript/typescript": ["JavaScript", "TypeScript"], "javascript / typescript": ["JavaScript", "TypeScript"], "c": ["C"], "c++": ["C++"], "c/c++": ["C", "C++"], "c#": ["C#"], "csharp": ["C#"], "java": ["Java"], "r": ["R"], "sql": ["SQL"], "go": ["Go"], "golang": ["Go"], "php": ["PHP"], "ruby": ["Ruby"], "rust": ["Rust"], "swift": ["Swift"], "kotlin": ["Kotlin"]};
    await q.query(`WITH candidates AS (
      SELECT p.id, ARRAY(SELECT DISTINCT language FROM jsonb_array_elements_text(coalesce(p.skills,'[]'::jsonb)) skill
        CROSS JOIN LATERAL jsonb_array_elements_text(coalesce($1::jsonb->lower(trim(skill)),'[]'::jsonb)) language ORDER BY language) languages
      FROM participants p
    ), selected AS (
      SELECT p.id, CASE WHEN cardinality(c.languages)=1 THEN c.languages[1] WHEN cardinality(c.languages)>1 THEN NULL
        WHEN trim(coalesce(p.python_skill,'')) ~* '^(beginner|intermediate|advanced|expert)\\y' THEN 'Python' ELSE NULL END preferred
      FROM participants p JOIN candidates c ON c.id=p.id
    ) UPDATE participants p SET preferred_language=s.preferred,
      language_proficiency=CASE WHEN s.preferred='Python' THEN initcap(substring(trim(coalesce(p.python_skill,'')) from '(?i)^(beginner|intermediate|advanced|expert)\\y')) ELSE NULL END
      FROM selected s WHERE s.id=p.id`, [JSON.stringify(aliases)]);
    await q.query(`UPDATE stages SET number=CASE workflow_key WHEN 'evaluation' THEN 5 WHEN 'build' THEN 6 END,
      sort_order=CASE workflow_key WHEN 'evaluation' THEN 5 WHEN 'build' THEN 6 END
      WHERE workflow_key IN ('evaluation','build') AND deleted_at IS NULL`);
    await q.query(`INSERT INTO stages(cohort_id,number,name,type,deadline,start_date,requirements,weight_percentage,is_active,
      allow_late_submissions,late_penalty_percentage,sort_order,workflow_key,requires_manual_approval,requires_ai_evaluation,description,instructions)
      SELECT p.cohort_id,4,'Team warmup','mixed',GREATEST(e.deadline,p.deadline),NULL,'{}',0,true,false,0,4,'warmup',false,true,
      'Build and deploy the team warmup web app after submitting your proposal.',
      'Build and deploy the to-do-list web app described by ATF. Submit its public HTTPS URL and GitHub repository for AI evaluation.'
      FROM stages p LEFT JOIN stages e ON e.cohort_id=p.cohort_id AND e.workflow_key='evaluation' AND e.deleted_at IS NULL
      WHERE p.workflow_key='proposal' AND p.deleted_at IS NULL`);
    await q.query(`UPDATE stages SET requires_manual_approval=false WHERE workflow_key='proposal' AND deleted_at IS NULL`);
  }
  async down(): Promise<void> {
    throw new Error("Builder confirmations and warmup submissions must be preserved; restore the application without reverting this data migration.");
  }
}
