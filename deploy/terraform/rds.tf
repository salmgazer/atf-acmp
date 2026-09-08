# ==============================================================================
# RDS PostgreSQL Database
# ==============================================================================

# Security group for RDS
resource "aws_security_group" "rds" {
  name        = "acmp-rds-${var.environment}"
  description = "Security group for ACMP RDS"
  vpc_id      = data.aws_vpc.default.id
  
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
    description = "PostgreSQL from VPC"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "acmp-${var.environment}"
  subnet_ids = data.aws_subnets.default.ids
  
  tags = {
    Name = "acmp-${var.environment}"
  }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier     = "acmp-${var.environment}"
  engine         = "postgres"
  engine_version = "15"
  
  instance_class    = var.db_instance_class
  allocated_storage = 20
  storage_type      = "gp2"
  
  db_name  = "acmp_${var.environment}"
  username = "acmp_admin"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  publicly_accessible    = false
  
  backup_retention_period = var.environment == "production" ? 7 : 1
  skip_final_snapshot     = var.environment != "production"
  deletion_protection     = var.environment == "production"
  
  tags = {
    Name = "acmp-${var.environment}"
  }
}
