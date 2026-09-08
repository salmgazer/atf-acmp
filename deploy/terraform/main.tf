# ==============================================================================
# ACMP Infrastructure - Terraform
# ==============================================================================

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Uncomment to use S3 backend for state (recommended for team use)
  # backend "s3" {
  #   bucket = "acmp-terraform-state"
  #   key    = "staging/terraform.tfstate"
  #   region = "af-south-1"
  # }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "acmp"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Get default VPC
data "aws_vpc" "default" {
  default = true
}

# Get default subnets
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}
