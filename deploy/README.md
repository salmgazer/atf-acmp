# ACMP AWS Deployment Guide - ECS Express Mode

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Route 53                                │
│                    (acmp.io domain)                            │
└──────────┬────────────────────────────────────────┬─────────────┘
           │                                        │
           ▼                                        ▼
┌─────────────────────────┐            ┌─────────────────────────┐
│       STAGING           │            │      PRODUCTION         │
│                         │            │                         │
│  api-staging.acmp.io    │            │  api.acmp.io           │
│  staging.acmp.io        │            │  app.acmp.io           │
├─────────────────────────┤            ├─────────────────────────┤
│                         │            │                         │
│  ┌───────────────────┐  │            │  ┌───────────────────┐  │
│  │ ECS Express Mode  │  │            │  │ ECS Express Mode  │  │
│  │   (API + Web)     │  │            │  │   (API + Web)     │  │
│  │   0.25 vCPU       │  │            │  │   1 vCPU x 2      │  │
│  │   512 MB          │  │            │  │   2 GB x 2        │  │
│  └─────────┬─────────┘  │            │  └─────────┬─────────┘  │
│            │            │            │            │            │
│  ┌─────────▼─────────┐  │            │  ┌─────────▼─────────┐  │
│  │   RDS Postgres    │  │            │  │   RDS Postgres    │  │
│  │   db.t3.micro     │  │            │  │   db.t3.medium    │  │
│  │   (FREE TIER)     │  │            │  │                   │  │
│  └───────────────────┘  │            │  └───────────────────┘  │
│                         │            │                         │
│  Redis: SKIP            │            │  ┌───────────────────┐  │
│  (in-memory sessions)   │            │  │   ElastiCache     │  │
│                         │            │  │   Redis           │  │
│                         │            │  └───────────────────┘  │
└─────────────────────────┘            └─────────────────────────┘

                    ┌─────────────────────┐
                    │      GitHub         │
                    │  push → Actions →   │
                    │  Build → ECR →      │
                    │  Deploy ECS         │
                    └─────────────────────┘
```

## Cost Summary

| Resource | Staging | Production |
|----------|---------|------------|
| ECS Fargate (API) | ~$10/mo | ~$50/mo |
| ECS Fargate (Web) | ~$10/mo | ~$30/mo |
| Application Load Balancer | ~$16/mo | ~$16/mo |
| RDS PostgreSQL | $0 (free tier) | ~$50/mo |
| ElastiCache Redis | $0 (skip) | ~$15/mo |
| ECR + S3 + Secrets | ~$3/mo | ~$5/mo |
| **Total** | **~$40/mo** | **~$165/mo** |

---

## Prerequisites

1. AWS Account with CLI configured
2. GitHub repository with Actions enabled
3. Docker installed locally (for testing)

---

## One-Time AWS Setup

### Step 1: Configure AWS CLI

```bash
aws configure
# Enter your AWS Access Key, Secret Key
# Region: af-south-1 (or your preferred region)
```

### Step 2: Enable af-south-1 Region (if needed)

If using Cape Town region:
1. Go to AWS Console → Account → AWS Regions
2. Enable "Africa (Cape Town)"
3. Wait ~10 minutes

### Step 3: Create ECR Repositories

```bash
export AWS_REGION=af-south-1

# Create repositories for Docker images
aws ecr create-repository --repository-name acmp/api --region $AWS_REGION
aws ecr create-repository --repository-name acmp/web --region $AWS_REGION
```

### Step 4: Create IAM Roles for ECS

```bash
# Create ECS Task Execution Role
cat > /tmp/ecs-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ecs-tasks.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file:///tmp/ecs-trust-policy.json

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Create ECS Infrastructure Role for Express Mode
cat > /tmp/ecs-infra-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ecs.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name ecsInfrastructureRoleForExpressServices \
  --assume-role-policy-document file:///tmp/ecs-infra-trust-policy.json

aws iam attach-role-policy \
  --role-name ecsInfrastructureRoleForExpressServices \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRolePolicyForExpressServices
```

### Step 5: Create GitHub OIDC Provider

```bash
# Get your AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create OIDC provider for GitHub Actions
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create role for GitHub Actions
cat > /tmp/github-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/acmp:*"
      }
    }
  }]
}
EOF

aws iam create-role \
  --role-name github-actions-ecs-role \
  --assume-role-policy-document file:///tmp/github-trust-policy.json

# Attach required policies
aws iam attach-role-policy \
  --role-name github-actions-ecs-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

aws iam attach-role-policy \
  --role-name github-actions-ecs-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess
```

### Step 6: Create RDS Database

```bash
# Get default VPC security group
SG_ID=$(aws ec2 describe-security-groups \
  --filters Name=group-name,Values=default \
  --query 'SecurityGroups[0].GroupId' --output text)

# Create staging database (FREE TIER)
aws rds create-db-instance \
  --db-instance-identifier acmp-staging \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15 \
  --master-username acmp_admin \
  --master-user-password "YOUR_SECURE_PASSWORD" \
  --allocated-storage 20 \
  --vpc-security-group-ids $SG_ID \
  --no-publicly-accessible \
  --backup-retention-period 1

# Wait for database to be ready
aws rds wait db-instance-available --db-instance-identifier acmp-staging

# Get the endpoint
aws rds describe-db-instances \
  --db-instance-identifier acmp-staging \
  --query 'DBInstances[0].Endpoint.Address' --output text
```

### Step 7: Create S3 Bucket

```bash
aws s3 mb s3://acmp-uploads-staging --region $AWS_REGION

# Configure CORS
cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [{
    "AllowedOrigins": ["https://staging.acmp.io", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
}
EOF

aws s3api put-bucket-cors --bucket acmp-uploads-staging --cors-configuration file:///tmp/cors.json
```

### Step 8: Store Secrets in AWS Secrets Manager

```bash
# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

aws secretsmanager create-secret \
  --name acmp/staging/database-password \
  --secret-string "YOUR_DB_PASSWORD"

aws secretsmanager create-secret \
  --name acmp/staging/jwt-secret \
  --secret-string "$JWT_SECRET"

aws secretsmanager create-secret \
  --name acmp/staging/mailchimp-api-key \
  --secret-string "YOUR_MAILCHIMP_KEY"
```

### Step 9: Configure GitHub Repository

Go to your GitHub repo → Settings → Secrets and variables → Actions

**Secrets:**
| Name | Value |
|------|-------|
| AWS_ROLE_ARN | `arn:aws:iam::<account-id>:role/github-actions-ecs-role` |
| AWS_ACCOUNT_ID | Your AWS account ID |
| DATABASE_PASSWORD_ARN | `arn:aws:secretsmanager:af-south-1:<account-id>:secret:acmp/staging/database-password` |
| JWT_SECRET_ARN | `arn:aws:secretsmanager:af-south-1:<account-id>:secret:acmp/staging/jwt-secret` |
| MAILCHIMP_API_KEY_ARN | `arn:aws:secretsmanager:af-south-1:<account-id>:secret:acmp/staging/mailchimp-api-key` |

**Variables:**
| Name | Value |
|------|-------|
| DATABASE_HOST | `acmp-staging.xxx.af-south-1.rds.amazonaws.com` |
| DATABASE_USER | `acmp_admin` |
| DATABASE_NAME | `postgres` |
| AWS_S3_BUCKET | `acmp-uploads-staging` |
| CORS_ORIGIN | `https://staging.acmp.io` |
| FRONTEND_URL | `https://staging.acmp.io` |
| NEXT_PUBLIC_API_URL | `https://api-staging.acmp.io` |
| NEXT_PUBLIC_WS_URL | `wss://api-staging.acmp.io` |
| MAILCHIMP_FROM_EMAIL | `noreply@atfchallenge.org` |
| MAILCHIMP_FROM_NAME | `ATF AI Challenge` |

---

## Deployment Flow

Once set up, deployments are automatic:

```
git push origin develop  →  GitHub Actions  →  Build Docker  →  Push ECR  →  Deploy ECS (Staging)
git push origin main     →  GitHub Actions  →  Build Docker  →  Push ECR  →  Deploy ECS (Production)
```

---

## Manual Deployment (First Time)

For the initial deployment, you can create the ECS Express service manually:

```bash
# Get your AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=af-south-1

# First, build and push the Docker image locally
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build API image
docker build -f apps/api/Dockerfile --target production -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/acmp/api:staging-latest .
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/acmp/api:staging-latest

# Create the ECS Express Mode service
aws ecs create-express-gateway-service \
  --service-name acmp-api-staging \
  --execution-role-arn arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole \
  --infrastructure-role-arn arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsInfrastructureRoleForExpressServices \
  --primary-container '{
    "image": "'$AWS_ACCOUNT_ID'.dkr.ecr.'$AWS_REGION'.amazonaws.com/acmp/api:staging-latest",
    "containerPort": 3000,
    "environment": [
      {"name": "NODE_ENV", "value": "staging"},
      {"name": "PORT", "value": "3000"}
    ]
  }' \
  --health-check-path "/health" \
  --scaling-target '{"minTaskCount": 1, "maxTaskCount": 2}' \
  --monitor-resources
```

---

## Useful Commands

```bash
# List ECS services
aws ecs list-services --cluster acmp-staging

# Describe service
aws ecs describe-services --cluster acmp-staging --services acmp-api-staging

# View logs
aws logs tail /ecs/acmp-api-staging --follow

# Force new deployment
aws ecs update-service --cluster acmp-staging --service acmp-api-staging --force-new-deployment

# Check RDS status
aws rds describe-db-instances --db-instance-identifier acmp-staging
```

---

## Troubleshooting

### Build fails in GitHub Actions
- Check that ECR repositories exist
- Verify AWS_ROLE_ARN is correct
- Check GitHub OIDC provider trust policy includes your repo

### Service doesn't start
- Check CloudWatch logs: `/ecs/<service-name>`
- Verify all environment variables are set
- Check security groups allow traffic on port 3000

### Database connection fails
- Verify RDS security group allows inbound from ECS
- Check DATABASE_HOST is the RDS endpoint
- Ensure DATABASE_SSL=true
