# ==============================================================================
# ECS Cluster
# ==============================================================================

resource "aws_ecs_cluster" "main" {
  name = "acmp-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "acmp-${var.environment}"
  }
}

# Cluster capacity providers for Fargate
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}
