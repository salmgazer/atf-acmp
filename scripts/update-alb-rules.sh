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
  
  TASK_ARN=$(aws ecs list-tasks --cluster "$cluster" --service-name "$service" --region "$AWS_REGION" --query "taskArns[0]" --output text 2>/dev/null || echo "")
  
  if [ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ]; then
    aws ecs describe-tasks --cluster "$cluster" --tasks "$TASK_ARN" --region "$AWS_REGION" \
      --query "tasks[0].attachments[0].details[?name=='privateIPv4Address'].value" --output text 2>/dev/null || echo ""
  else
    echo ""
  fi
}

# Function to find target group ARN by IP (checks all states, not just healthy)
find_target_group_by_ip() {
  local target_ip=$1
  
  # Get all target groups
  TG_ARNS=$(aws elbv2 describe-target-groups --region "$AWS_REGION" --query "TargetGroups[*].TargetGroupArn" --output text 2>/dev/null || echo "")
  
  if [ -z "$TG_ARNS" ]; then
    echo ""
    return
  fi
  
  for tg_arn in $TG_ARNS; do
    # Check all targets regardless of health state
    targets=$(aws elbv2 describe-target-health --target-group-arn "$tg_arn" --region "$AWS_REGION" \
      --query "TargetHealthDescriptions[*].Target.Id" --output text 2>/dev/null || echo "")
    
    if [ -n "$targets" ] && echo "$targets" | grep -qw "$target_ip"; then
      echo "$tg_arn"
      return
    fi
  done
  
  echo ""
}

# Get task IPs
echo ""
echo "Finding service IPs..."
API_IP=$(get_task_ip "$CLUSTER" "$API_SERVICE")
WEB_IP=$(get_task_ip "$CLUSTER" "$WEB_SERVICE")

echo "  $API_SERVICE: ${API_IP:-NOT FOUND}"
echo "  $WEB_SERVICE: ${WEB_IP:-NOT FOUND}"

if [ -z "$API_IP" ] || [ -z "$WEB_IP" ]; then
  echo "ERROR: Could not find task IPs. Services may not be running."
  exit 1
fi

# Wait a bit for target registration
echo ""
echo "Waiting 15 seconds for target registration..."
sleep 15

# Find target groups with retry
find_target_groups_with_retry() {
  local api_ip=$1
  local web_ip=$2
  local max_retries=3
  local retry_delay=30
  
  for i in $(seq 1 $max_retries); do
    echo ""
    echo "Attempt $i of $max_retries: Finding target groups..."
    
    API_TG_ARN=$(find_target_group_by_ip "$api_ip")
    WEB_TG_ARN=$(find_target_group_by_ip "$web_ip")
    
    echo "  API Target Group: ${API_TG_ARN:-NOT FOUND}"
    echo "  Web Target Group: ${WEB_TG_ARN:-NOT FOUND}"
    
    if [ -n "$API_TG_ARN" ] && [ -n "$WEB_TG_ARN" ]; then
      return 0
    fi
    
    if [ $i -lt $max_retries ]; then
      echo ""
      echo "Target groups not found yet. Waiting $retry_delay seconds before retry..."
      sleep $retry_delay
    fi
  done
  
  return 1
}

if ! find_target_groups_with_retry "$API_IP" "$WEB_IP"; then
  echo ""
  echo "ERROR: Could not find target groups after multiple retries."
  echo ""
  echo "Debug info - listing all target groups with their targets:"
  TG_LIST=$(aws elbv2 describe-target-groups --region "$AWS_REGION" --query "TargetGroups[*].TargetGroupArn" --output text 2>/dev/null || echo "")
  for tg in $TG_LIST; do
    echo "  TG: $tg"
    aws elbv2 describe-target-health --target-group-arn "$tg" --region "$AWS_REGION" \
      --query "TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]" --output text 2>/dev/null | sed 's/^/    /' || echo "    (failed to get targets)"
  done
  exit 1
fi

# Get current listener rules
echo ""
echo "Updating listener rules..."
RULES=$(aws elbv2 describe-rules --listener-arn "$LISTENER_ARN" --region "$AWS_REGION" --output json 2>/dev/null)

if [ -z "$RULES" ]; then
  echo "ERROR: Could not fetch listener rules."
  exit 1
fi

# Update API rule
API_RULE_ARN=$(echo "$RULES" | jq -r ".Rules[] | select(.Conditions[0].Values[0]==\"$API_DOMAIN\") | .RuleArn" 2>/dev/null || echo "")
if [ -n "$API_RULE_ARN" ] && [ "$API_RULE_ARN" != "null" ]; then
  echo "  Updating $API_DOMAIN -> $API_TG_ARN"
  aws elbv2 modify-rule --rule-arn "$API_RULE_ARN" \
    --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"$API_TG_ARN\"}]" \
    --region "$AWS_REGION" --output text > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "    ✓ Updated successfully"
  else
    echo "    ✗ Failed to update"
  fi
else
  echo "  WARNING: No rule found for $API_DOMAIN"
fi

# Update App rule
APP_RULE_ARN=$(echo "$RULES" | jq -r ".Rules[] | select(.Conditions[0].Values[0]==\"$APP_DOMAIN\") | .RuleArn" 2>/dev/null || echo "")
if [ -n "$APP_RULE_ARN" ] && [ "$APP_RULE_ARN" != "null" ]; then
  echo "  Updating $APP_DOMAIN -> $WEB_TG_ARN"
  aws elbv2 modify-rule --rule-arn "$APP_RULE_ARN" \
    --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"$WEB_TG_ARN\"}]" \
    --region "$AWS_REGION" --output text > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "    ✓ Updated successfully"
  else
    echo "    ✗ Failed to update"
  fi
else
  echo "  WARNING: No rule found for $APP_DOMAIN"
fi

echo ""
echo "========================================"
echo "ALB rules updated successfully!"
echo "========================================"
