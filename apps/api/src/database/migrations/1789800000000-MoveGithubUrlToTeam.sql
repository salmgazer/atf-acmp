-- Migration: MoveGithubUrlToTeam
-- Add github_repo_url column to teams table

ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "github_repo_url" VARCHAR(500) NULL;

-- Migrate existing github_url data from submissions to teams
-- Takes the most recent non-null github_url from each team's submissions
UPDATE "teams" t
SET "github_repo_url" = sub.github_url
FROM (
  SELECT DISTINCT ON (s.team_id) s.team_id, s.github_url
  FROM "submissions" s
  WHERE s.github_url IS NOT NULL AND s.github_url != ''
  ORDER BY s.team_id, s.created_at DESC
) sub
WHERE t.id = sub.team_id AND t.github_repo_url IS NULL;
