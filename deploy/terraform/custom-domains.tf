# ==============================================================================
# Custom Domain Configuration for ECS Express Mode
# ==============================================================================
# This configures HTTPS and custom domain routing for the ALB created by
# ECS Express Mode. The ALB is shared across all Express Mode services.
#
# PREREQUISITES:
# 1. Services must be deployed via GitHub Actions first (creates target groups)
# 2. ACM certificate must be validated (DNS records already added)
# 3. Get the required ARNs from AWS Console (see variables below)
#
# USAGE:
# 1. Get the ARNs from AWS Console
# 2. Add them to staging.tfvars or production.tfvars
# 3. Run: terraform plan -var-file=staging.tfvars
# 4. Run: terraform apply -var-file=staging.tfvars
# ==============================================================================

locals {
  domain_name = "atfchallenge.org"
  
  # Subdomains for each environment
  api_subdomain = var.environment == "production" ? "api" : "api-staging"
  app_subdomain = var.environment == "production" ? "app" : "app-staging"
  
  api_domain = "${local.api_subdomain}.${local.domain_name}"
  app_domain = "${local.app_subdomain}.${local.domain_name}"
  
  # Only create resources if all ARNs are provided
  create_custom_domains = (
    var.ecs_express_alb_arn != "" && 
    var.acm_certificate_arn != "" && 
    var.api_target_group_arn != "" && 
    var.web_target_group_arn != ""
  )
}

# ==============================================================================
# Variables for custom domains
# ==============================================================================

variable "ecs_express_alb_arn" {
  description = <<-EOT
    ARN of the ECS Express Gateway ALB.
    Find it: AWS Console → EC2 → Load Balancers → ecs-express-gateway-alb-* → Copy ARN
  EOT
  type    = string
  default = ""
}

variable "acm_certificate_arn" {
  description = <<-EOT
    ARN of the ACM certificate for *.atfchallenge.org.
    Find it: AWS Console → Certificate Manager → Select certificate → Copy ARN
    Must be in same region as ALB (eu-central-1)
  EOT
  type    = string
  default = ""
}

variable "api_target_group_arn" {
  description = <<-EOT
    ARN of the API service target group created by ECS Express Mode.
    Find it: AWS Console → EC2 → Target Groups → acmp-api-staging (or acmp-api-production) → Copy ARN
  EOT
  type    = string
  default = ""
}

variable "web_target_group_arn" {
  description = <<-EOT
    ARN of the Web service target group created by ECS Express Mode.
    Find it: AWS Console → EC2 → Target Groups → acmp-web-staging (or acmp-web-production) → Copy ARN
  EOT
  type    = string
  default = ""
}

# ==============================================================================
# Data Source - Reference the ALB
# ==============================================================================

data "aws_lb" "ecs_express_gateway" {
  count = local.create_custom_domains ? 1 : 0
  arn   = var.ecs_express_alb_arn
}

# ==============================================================================
# HTTPS Listener
# ==============================================================================

resource "aws_lb_listener" "https" {
  count = local.create_custom_domains ? 1 : 0

  load_balancer_arn = var.ecs_express_alb_arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found - Invalid host"
      status_code  = "404"
    }
  }

  tags = {
    Name        = "acmp-https-listener"
    Environment = var.environment
  }
}

# ==============================================================================
# Listener Rules - Host-based Routing for HTTPS
# ==============================================================================

# Route api.atfchallenge.org (or api-staging) to API service
resource "aws_lb_listener_rule" "api_https" {
  count = local.create_custom_domains ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = var.environment == "production" ? 10 : 20

  action {
    type             = "forward"
    target_group_arn = var.api_target_group_arn
  }

  condition {
    host_header {
      values = [local.api_domain]
    }
  }

  tags = {
    Name        = "acmp-${var.environment}-api-https-rule"
    Environment = var.environment
  }
}

# Route app.atfchallenge.org (or app-staging) to Web service
resource "aws_lb_listener_rule" "app_https" {
  count = local.create_custom_domains ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = var.environment == "production" ? 11 : 21

  action {
    type             = "forward"
    target_group_arn = var.web_target_group_arn
  }

  condition {
    host_header {
      values = [local.app_domain]
    }
  }

  tags = {
    Name        = "acmp-${var.environment}-app-https-rule"
    Environment = var.environment
  }
}

# ==============================================================================
# HTTP to HTTPS Redirect Rules
# ==============================================================================

# Find existing HTTP listener created by ECS Express Mode
data "aws_lb_listener" "http" {
  count             = local.create_custom_domains ? 1 : 0
  load_balancer_arn = var.ecs_express_alb_arn
  port              = 80
}

# Redirect HTTP to HTTPS for API domain
resource "aws_lb_listener_rule" "api_http_redirect" {
  count = local.create_custom_domains ? 1 : 0

  listener_arn = data.aws_lb_listener.http[0].arn
  priority     = var.environment == "production" ? 10 : 20

  action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  condition {
    host_header {
      values = [local.api_domain]
    }
  }

  tags = {
    Name        = "acmp-${var.environment}-api-http-redirect"
    Environment = var.environment
  }
}

# Redirect HTTP to HTTPS for App domain
resource "aws_lb_listener_rule" "app_http_redirect" {
  count = local.create_custom_domains ? 1 : 0

  listener_arn = data.aws_lb_listener.http[0].arn
  priority     = var.environment == "production" ? 11 : 21

  action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  condition {
    host_header {
      values = [local.app_domain]
    }
  }

  tags = {
    Name        = "acmp-${var.environment}-app-http-redirect"
    Environment = var.environment
  }
}

# ==============================================================================
# Outputs
# ==============================================================================

output "custom_domain_status" {
  description = "Custom domain configuration status"
  value = local.create_custom_domains ? {
    configured = true
    api_url    = "https://${local.api_domain}"
    app_url    = "https://${local.app_domain}"
  } : {
    configured = false
    message    = "Custom domains not configured. Add ARNs to tfvars file."
  }
}

output "required_arns_instructions" {
  description = "Instructions to get required ARNs"
  value = local.create_custom_domains ? null : <<-EOT
    
    ============================================================
    CUSTOM DOMAINS NOT CONFIGURED - ARNs Required
    ============================================================
    
    Add the following to your ${var.environment}.tfvars file:
    
    1. ECS Express ALB ARN:
       AWS Console → EC2 → Load Balancers → ecs-express-gateway-alb-*
       
       ecs_express_alb_arn = "arn:aws:elasticloadbalancing:eu-central-1:ACCOUNT:loadbalancer/app/ecs-express-gateway-alb-XXXXX/YYYY"
    
    2. ACM Certificate ARN:
       AWS Console → Certificate Manager → *.atfchallenge.org certificate
       
       acm_certificate_arn = "arn:aws:acm:eu-central-1:ACCOUNT:certificate/XXXXX"
    
    3. API Target Group ARN:
       AWS Console → EC2 → Target Groups → acmp-api-${var.environment}
       
       api_target_group_arn = "arn:aws:elasticloadbalancing:eu-central-1:ACCOUNT:targetgroup/acmp-api-${var.environment}/XXXXX"
    
    4. Web Target Group ARN:
       AWS Console → EC2 → Target Groups → acmp-web-${var.environment}
       
       web_target_group_arn = "arn:aws:elasticloadbalancing:eu-central-1:ACCOUNT:targetgroup/acmp-web-${var.environment}/XXXXX"
    
    Then run: terraform apply -var-file=${var.environment}.tfvars
    ============================================================
  EOT
}
