# ==============================================================================
# AWS Secrets Manager
# ==============================================================================

resource "aws_secretsmanager_secret" "db_password" {
  name = "acmp/${var.environment}/database-password"
  
  tags = {
    Name = "acmp-${var.environment}-db-password"
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "acmp/${var.environment}/jwt-secret"
  
  tags = {
    Name = "acmp-${var.environment}-jwt-secret"
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
  name = "acmp/${var.environment}/mailchimp-api-key"
  
  tags = {
    Name = "acmp-${var.environment}-mailchimp-api-key"
  }
}

resource "aws_secretsmanager_secret_version" "mailchimp_api_key" {
  secret_id     = aws_secretsmanager_secret.mailchimp_api_key.id
  secret_string = var.mailchimp_api_key
}
