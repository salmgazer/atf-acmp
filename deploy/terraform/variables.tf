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
  default     = "atf-acmp"
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


# Google Calendar Integration
variable "google_service_account_email" {
  description = "Google Service Account email for Calendar API"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_private_key" {
  description = "Google Service Account private key (PEM format)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_admin_email" {
  description = "Google Workspace admin email for domain-wide delegation"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_calendar_email" {
  description = "Google Calendar email to manage events"
  type        = string
  sensitive   = true
  default     = ""
}


# ==============================================================================
# SMTP Configuration
# ==============================================================================

variable "smtp_host" {
  description = "SMTP server hostname"
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP server port"
  type        = string
  default     = "587"
}

variable "smtp_secure" {
  description = "Use SSL/TLS for SMTP (true for port 465)"
  type        = string
  default     = "false"
}

variable "smtp_user" {
  description = "SMTP authentication username"
  type        = string
  sensitive   = true
  default     = ""
}

variable "smtp_pass" {
  description = "SMTP authentication password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "smtp_from_email" {
  description = "Email address to send from"
  type        = string
  default     = ""
}

variable "smtp_from_name" {
  description = "Display name for sent emails"
  type        = string
  default     = ""
}
