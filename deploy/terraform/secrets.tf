# ==============================================================================
# AWS Secrets Manager
# Naming convention: acmp-{environment}-{secret-name}
# ==============================================================================

# Note: The existing secrets (database-password, jwt-secret, mailchimp-api-key)
# already exist with dash naming in AWS (acmp-staging-*). The Terraform state
# may reference slash naming (acmp/staging/*) but we're standardizing on dashes.
# You may need to import existing secrets or delete the slash-named duplicates.

resource "aws_secretsmanager_secret" "db_password" {
  name = "acmp-${var.environment}-database-password"
  
  tags = {
    Name        = "acmp-${var.environment}-database-password"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "acmp-${var.environment}-jwt-secret"
  
  tags = {
    Name        = "acmp-${var.environment}-jwt-secret"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "mailchimp_api_key" {
  name = "acmp-${var.environment}-mailchimp-api-key"
  
  tags = {
    Name        = "acmp-${var.environment}-mailchimp-api-key"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "mailchimp_api_key" {
  secret_id     = aws_secretsmanager_secret.mailchimp_api_key.id
  secret_string = var.mailchimp_api_key
}

# ==============================================================================
# Google Calendar Integration Secrets
# ==============================================================================

resource "aws_secretsmanager_secret" "google_service_account_email" {
  count = var.google_service_account_email != "" ? 1 : 0
  name  = "acmp-${var.environment}-google-service-account-email"
  
  tags = {
    Name        = "acmp-${var.environment}-google-service-account-email"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "google_service_account_email" {
  count         = var.google_service_account_email != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.google_service_account_email[0].id
  secret_string = var.google_service_account_email
}

resource "aws_secretsmanager_secret" "google_private_key" {
  count = var.google_private_key != "" ? 1 : 0
  name  = "acmp-${var.environment}-google-private-key"
  
  tags = {
    Name        = "acmp-${var.environment}-google-private-key"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "google_private_key" {
  count         = var.google_private_key != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.google_private_key[0].id
  secret_string = var.google_private_key
}

resource "aws_secretsmanager_secret" "google_admin_email" {
  count = var.google_admin_email != "" ? 1 : 0
  name  = "acmp-${var.environment}-google-admin-email"
  
  tags = {
    Name        = "acmp-${var.environment}-google-admin-email"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "google_admin_email" {
  count         = var.google_admin_email != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.google_admin_email[0].id
  secret_string = var.google_admin_email
}

resource "aws_secretsmanager_secret" "google_calendar_email" {
  count = var.google_calendar_email != "" ? 1 : 0
  name  = "acmp-${var.environment}-google-calendar-email"
  
  tags = {
    Name        = "acmp-${var.environment}-google-calendar-email"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "google_calendar_email" {
  count         = var.google_calendar_email != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.google_calendar_email[0].id
  secret_string = var.google_calendar_email
}
