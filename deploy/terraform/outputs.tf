# ==============================================================================
# Outputs - Values needed for GitHub Actions
# ==============================================================================

output "github_secrets" {
  description = "Add these to GitHub → Settings → Secrets"
  value = {
    AWS_ROLE_ARN          = aws_iam_role.github_actions.arn
    AWS_ACCOUNT_ID        = data.aws_caller_identity.current.account_id
    DATABASE_PASSWORD_ARN = aws_secretsmanager_secret.db_password.arn
    JWT_SECRET_ARN        = aws_secretsmanager_secret.jwt_secret.arn
    MAILCHIMP_API_KEY_ARN = aws_secretsmanager_secret.mailchimp_api_key.arn
  }
}

output "github_variables" {
  description = "Add these to GitHub → Settings → Variables"
  value = {
    DATABASE_HOST        = aws_db_instance.main.address
    DATABASE_USER        = "acmp_admin"
    DATABASE_NAME        = "acmp_${var.environment}"
    AWS_S3_BUCKET        = aws_s3_bucket.uploads.id
    CORS_ORIGIN          = "*"
    FRONTEND_URL         = "https://${var.environment == "production" ? "" : "staging."}acmp.io"
    NEXT_PUBLIC_API_URL  = "https://api${var.environment == "production" ? "" : "-staging"}.acmp.io"
    NEXT_PUBLIC_WS_URL   = "wss://api${var.environment == "production" ? "" : "-staging"}.acmp.io"
    MAILCHIMP_FROM_EMAIL = "noreply@atfchallenge.org"
    MAILCHIMP_FROM_NAME  = "ATF AI Challenge"
  }
}

output "ecr_repositories" {
  description = "ECR repository URLs"
  value = {
    api = aws_ecr_repository.api.repository_url
    web = aws_ecr_repository.web.repository_url
  }
}

output "rds_endpoint" {
  description = "RDS database endpoint"
  value       = aws_db_instance.main.address
}

output "iam_roles" {
  description = "IAM role ARNs for ECS"
  value = {
    task_execution = aws_iam_role.ecs_task_execution.arn
    infrastructure = aws_iam_role.ecs_infrastructure.arn
    github_actions = aws_iam_role.github_actions.arn
  }
}
