# ==============================================================================
# ElastiCache Redis Configuration
# ==============================================================================

# Security group for ElastiCache
resource "aws_security_group" "redis" {
  name        = "acmp-redis-${var.environment}"
  description = "Security group for ACMP ElastiCache Redis"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Redis from VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "acmp-redis-${var.environment}"
  }
}

# ElastiCache subnet group
resource "aws_elasticache_subnet_group" "main" {
  name       = "acmp-redis-${var.environment}"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Name = "acmp-redis-${var.environment}"
  }
}

# ElastiCache Redis cluster (single node for cost efficiency)
resource "aws_elasticache_cluster" "main" {
  cluster_id           = "acmp-${var.environment}"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  port                 = 6379
  parameter_group_name = "default.redis7"

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Maintenance window (Sunday 3-4 AM UTC)
  maintenance_window = "sun:03:00-sun:04:00"

  # Snapshot settings (disable for cost savings on small instances)
  snapshot_retention_limit = var.environment == "production" ? 1 : 0

  # Apply changes immediately in staging, during maintenance window in production
  apply_immediately = var.environment != "production"

  tags = {
    Name        = "acmp-${var.environment}"
    Environment = var.environment
  }
}
