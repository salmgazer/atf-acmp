# ==============================================================================
# Variables
# ==============================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment name (staging or production)"
  type        = string
  default     = "staging"
}

variable "github_org" {
  description = "GitHub organization or username"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "acmp"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"  # Free tier eligible
}

variable "mailchimp_api_key" {
  description = "Mailchimp API key"
  type        = string
  sensitive   = true
  default     = "placeholder-update-later"
}

# ECS Configuration
variable "api_cpu" {
  description = "API task CPU units"
  type        = number
  default     = 256  # 0.25 vCPU
}

variable "api_memory" {
  description = "API task memory (MB)"
  type        = number
  default     = 512
}

variable "web_cpu" {
  description = "Web task CPU units"
  type        = number
  default     = 256
}

variable "web_memory" {
  description = "Web task memory (MB)"
  type        = number
  default     = 512
}

variable "min_tasks" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "max_tasks" {
  description = "Maximum number of tasks"
  type        = number
  default     = 2
}
