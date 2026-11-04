#!/usr/bin/env bash
# Refresh custom-domain routes from the active ECS Express Gateway listener.
# Usage: DRY_RUN=true bash scripts/update-alb-rules.sh staging
set -euo pipefail

ENVIRONMENT=${1:-staging}
AWS_REGION=${AWS_REGION:-eu-central-1}
LISTENER_ARN=${LISTENER_ARN:-"arn:aws:elasticloadbalancing:eu-central-1:338324195747:listener/app/ecs-express-gateway-alb-897d68bc/64625719adf9d240/ec30f9a1c834e7bc"}
DRY_RUN=${DRY_RUN:-false}

case "$ENVIRONMENT" in
  production)
    API_DOMAIN="api.atfchallenge.org"
    APP_DOMAIN="app.atfchallenge.org"
    BUILT_DOMAIN="built.atfchallenge.org"
    ;;
  staging)
    API_DOMAIN="api-staging.atfchallenge.org"
    APP_DOMAIN="app-staging.atfchallenge.org"
    BUILT_DOMAIN=""
    ;;
  *) echo "Unknown environment: $ENVIRONMENT" >&2; exit 1 ;;
esac
CLUSTER="acmp-$ENVIRONMENT"

echo "Updating $ENVIRONMENT custom-domain routes in $AWS_REGION (dry run: $DRY_RUN)"

# Express Gateway uses two target groups during deployment. Read its active
# listener rule to select the serving group, without scanning target health.
get_service_target_group() {
  local service=$1 service_arn configuration revision_arn gateway_rule
  service_arn=$(aws ecs describe-services --cluster "$CLUSTER" --services "$service" \
    --region "$AWS_REGION" --query 'services[0].serviceArn' --output text) || return 1
  if [ -z "$service_arn" ] || [ "$service_arn" = "None" ]; then
    echo "Could not find ECS service $service" >&2
    return 1
  fi

  configuration=$(aws ecs describe-express-gateway-service --service-arn "$service_arn" \
    --region "$AWS_REGION" --query 'service.{status:status.statusCode,revisions:activeConfigurations[].serviceRevisionArn}' \
    --output json) || return 1
  revision_arn=$(jq -er 'select(.status == "ACTIVE" and (.revisions | length) == 1) | .revisions[0]' \
    <<< "$configuration") || return 1
  gateway_rule=$(aws ecs describe-service-revisions --service-revision-arns "$revision_arn" \
    --region "$AWS_REGION" --query 'serviceRevisions[0].loadBalancers[0].advancedConfiguration.productionListenerRule' \
    --output text) || return 1
  if [ -z "$gateway_rule" ] || [ "$gateway_rule" = "None" ]; then
    echo "Could not find the Express Gateway listener rule for $service" >&2
    return 1
  fi

  aws elbv2 describe-rules --rule-arns "$gateway_rule" --region "$AWS_REGION" --output json | \
    jq -er '[.Rules[].Actions[] | select(.Type == "forward") |
      if .ForwardConfig then .ForwardConfig.TargetGroups[] | select((.Weight // 1) > 0)
      else {TargetGroupArn: .TargetGroupArn} end] |
      unique_by(.TargetGroupArn) |
      if length == 1 and .[0].TargetGroupArn != null then .[0].TargetGroupArn
      else error("Gateway traffic has not settled on one target group yet") end'
}

API_TG_ARN=""
WEB_TG_ARN=""
for attempt in 1 2 3 4 5; do
  echo "Discovering active routing targets (attempt $attempt of 5)..."
  API_TG_ARN=$(get_service_target_group "acmp-api-$ENVIRONMENT") || API_TG_ARN=""
  WEB_TG_ARN=$(get_service_target_group "acmp-web-$ENVIRONMENT") || WEB_TG_ARN=""
  if [ -n "$API_TG_ARN" ] && [ -n "$WEB_TG_ARN" ]; then break; fi
  if [ "$attempt" -lt 5 ]; then sleep 20; fi
done
if [ -z "$API_TG_ARN" ] || [ -z "$WEB_TG_ARN" ]; then
  echo "Could not determine stable API and web routing targets" >&2
  exit 1
fi

RULES=$(aws elbv2 describe-rules --listener-arn "$LISTENER_ARN" --region "$AWS_REGION" --output json)

update_domain() {
  local domain=$1 target_group=$2 rule_arn
  rule_arn=$(jq -er --arg domain "$domain" '[.Rules[] |
    select(any(.Conditions[]?;
      .Field == "host-header" and ((.Values // .HostHeaderConfig.Values // []) | index($domain)))) |
    .RuleArn] | if length == 1 then .[0] else error("Expected exactly one listener rule for " + $domain) end' \
    <<< "$RULES")
  echo "$domain -> $target_group"
  if [ "$DRY_RUN" != "true" ]; then
    aws elbv2 modify-rule --rule-arn "$rule_arn" \
      --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"$target_group\"}]" \
      --region "$AWS_REGION" --output json > /dev/null
    echo "Updated $domain"
  fi
}

update_domain "$API_DOMAIN" "$API_TG_ARN"
update_domain "$APP_DOMAIN" "$WEB_TG_ARN"
if [ -n "$BUILT_DOMAIN" ]; then update_domain "$BUILT_DOMAIN" "$WEB_TG_ARN"; fi
echo "Custom-domain routing check completed successfully"
