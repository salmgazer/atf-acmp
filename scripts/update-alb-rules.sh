#!/bin/bash
# ==============================================================================
# Update ALB Listener Rules for Custom Domains
# ==============================================================================
# This script updates the ALB listener rules to point to the correct target
# groups after ECS Express Mode deployments. ECS Express Mode rotates target
# groups during deployments, so we need to update our custom domain rules.
#
# Usage: ./update-alb-rules.sh <environment>
# Example: ./update-alb-rules.sh staging
# ==============================================================================

set -e

ENVIRONMENT=${1:-staging}
AWS_REGION=${AWS_REGION:-eu-central-1}
LISTENER_ARN=${LISTENER_ARN:-"arn:aws:elasticloadbalancing:eu-central-1:338324195747:listener/app/ecs-express-gateway-alb-897d68bc/64625719adf9d240/ec30f9a1c834e7bc"}

echo "========================================"
echo "Updating ALB rules for: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "========================================"

# Determine cluster and domains based on environment
if [ "$ENVIRONMENT" = "production" ]; then
  CLUSTER="acmp-production"
  API_DOMAIN="api.atfchallenge.org"
  APP_DOMAIN="app.atfchallenge.org"
  API_SERVICE="acmp-api-production"
  WEB_SERVICE="acmp-web-production"
else
  CLUSTER="acmp-staging"
  API_DOMAIN="api-staging.atfchallenge.org"
  APP_DOMAIN="app-staging.atfchallenge.org"
  API_SERVICE="acmp-api-staging"
  WEB_SERVICE="acmp-web-staging"
fi

echo ""
echo "Cluster: $CLUSTER"
echo "API Domain: $API_DOMAIN"
echo "App Domain: $APP_DOMAIN"

# Function to get task IP for a service
get_task_ip() {
  local cluster=$1
  local service=$2
  
  TASK_ARN=$(aws ecs list-tasks --cluster "$cluster" --service-name "$service" --region "$AWS_REGION" --query "taskArns[0]" --output text 2>/dev/null)
  
  if [ "$TASK_ARN" != "None" ] && [ -n "$TASK_ARN" ]; then
    aws ecs describe-tasks --cluster "$cluster" --tasks "$TASK_ARN" --region "$AWS_REGION" \
      --query "tasks[0].attachments[0].details[?name=='privateIPv4Address'].value" --output text 2>/dev/null
  fi
}

# Function to find target group ARN by IP (checks all states, not just healthy)
find_target_group_by_ip() {
  local target_ip=$1
  local found_tg=""
  
  # Get all target groups
  TG_ARNS=$(aws elbv2 describe-target-groups --region "$AWS_REGION" --query "TargetGroups[*].TargetGroupArn" --output text)
  
  for tg_arn in $TG_ARNS; do
    # Check all targets regardless of health state
    targets=$(aws elbv2 describe-target-health --target-group-arn "$tg_arn" --region "$AWS_REGION" \
      --query "TargetHealthDescriptions[*].Target.Id" --output text 2>/dev/null || echo "")
    
    if echo "$targets" | grep -qw "$target_ip"; then
      echo "$tg_arn"
      return 0
    fi
  done
  
  echo ""
  return 1
}

# Get task IPs
echo ""
echo "Finding service IPs..."
API_IP=$(get_task_ip "$CLUSTER" "$API_SERVICE")
WEB_IP=$(get_task_ip "$CLUSTER" "$WEB_SERVICE")

echo "  $API_SERVICE: $API_IP"
echo "  $WEB_SERVICE: $WEB_IP"

if [ -z "$API_IP" ] || [ -z "$WEB_IP" ]; then
  echo "ERROR: Could not find task IPs. Services may not be running."
  exit 1
fi

# Wait a bit for target registration
echo ""
echo "Waiting 15 seconds for target registration..."
sleep 15

# Find target groups
echo ""
echo "Finding target groups..."
API_TG_ARN=$(find_target_group_by_ip "$API_IP")
WEB_TG_ARN=$(find_target_group_by_ip "$WEB_IP")

echo "  API Target Group: ${API_TG_ARN:-NOT FOUND}"
echo "  Web Target Group: ${WEB_TG_ARN:-NOT FOUND}"

if [ -z "$API_TG_ARN" ] || [ -z "$WEB_TG_ARN" ]; then
  echo ""
  echo "WARNING: Could not find target groups for the service IPs."
  echo "This may happen if target registration is still in progress."
  echo "Waiting another 30 seconds and retrying..."
  sleep 30
  
  API_TG_ARN=$(find_target_group_by_ip "$API_IP")
  WEB_TG_ARN=$(find_target_group_by_ip "$WEB_IP")
  
  echo "  API Target Group (retry): ${API_TG_ARN:-NOT FOUND}"
  echo "  Web Target Group (retry): ${WEB_TG_ARN:-NOT FOUND}"
  
  if [ -z "$API_TG_ARN" ] || [ -z "$WEB_TG_ARN" ]; then
    echo ""
    echo "ERROR: Still could not find target groups after retry."
    echo "Listing all target groups with their targets for debugging:"
    aws elbv2 describe-target-groups --region "$AWS_REGION" --query "TargetGroups[*].[TargetGroupArn]" --output text | while read tg; do
      echo "  TG: $tg"
      aws elbv2 describe-target-health --target-group-arn "$tg" --region "$AWS_REGION" \
        --query "TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]" --output text 2>/dev/null | sed 's/^/    /'
    done
    exit 1
  fi
fi

# Get current listener rules
echo ""
echo "Updating listener rules..."
RULES=$(aws elbv2 describe-rules --listener-arn "$LISTENER_ARN" --region "$AWS_REGION" --output json)

# Update API rule
API_RULE_ARN=$(echo "$RULES" | jq -r ".Rules[] | select(.Conditions[0].Values[0]==\"$API_DOMAIN\") | .RuleArn")
if [ -n "$API_RULE_ARN" ] && [ "$API_RULE_ARN" != "null" ]; then
  echo "  Updating $API_DOMAIN -> $API_TG_ARN"
  aws elbv2 modify-rule --rule-arn "$API_RULE_ARN" \
    --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"$API_TG_ARN\"}]" \
    --region "$AWS_REGION" --output text > /dev/null
else
  echo "  WARNING: No rule found for $API_DOMAIN"
fi

# Update App rule
APP_RULE_ARN=$(echo "$RULES" | jq -r ".Rules[] | select(.Conditions[0].Values[0]==\"$APP_DOMAIN\") | .RuleArn")
if [ -n "$APP_RULE_ARN" ] && [ "$APP_RULE_ARN" != "null" ]; then
  echo "  Updating $APP_DOMAIN -> $WEB_TG_ARN"
  aws elbv2 modify-rule --rule-arn "$APP_RULE_ARN" \
    --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"$WEB_TG_ARN\"}]" \
    --region "$AWS_REGION" --output text > /dev/null
else
  echo "  WARNING: No rule found for $APP_DOMAIN"
fi

echo ""
echo "========================================"
echo "ALB rules updated successfully!"
echo "========================================"
