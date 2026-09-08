# ==============================================================================
# IAM Roles
# ==============================================================================

# ECS Task Execution Role
resource "aws_iam_role" "ecs_task_execution" {
  name = "ecsTaskExecutionRole-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow ECS to read secrets
resource "aws_iam_role_policy" "ecs_secrets_access" {
  name = "secrets-access"
  role = aws_iam_role.ecs_task_execution.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = [
        aws_secretsmanager_secret.db_password.arn,
        aws_secretsmanager_secret.jwt_secret.arn,
        aws_secretsmanager_secret.mailchimp_api_key.arn
      ]
    }]
  })
}

# ECS Infrastructure Role for Express Mode
resource "aws_iam_role" "ecs_infrastructure" {
  name = "ecsInfrastructureRoleForExpressServices-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_infrastructure" {
  role       = aws_iam_role.ecs_infrastructure.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices"
}

# GitHub Actions OIDC Provider
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# GitHub Actions Role
resource "aws_iam_role" "github_actions" {
  name = "github-actions-ecs-role-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "github_ecr" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
}

resource "aws_iam_role_policy_attachment" "github_ecs" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonECS_FullAccess"
}

# Allow GitHub Actions to pass roles to ECS
resource "aws_iam_role_policy" "github_pass_role" {
  name = "pass-role-to-ecs"
  role = aws_iam_role.github_actions.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "iam:PassRole"
      Resource = [
        aws_iam_role.ecs_task_execution.arn,
        aws_iam_role.ecs_infrastructure.arn
      ]
    }]
  })
}
