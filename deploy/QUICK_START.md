# ACMP Staging - Quick Start (ECS Express Mode)

Get staging running in ~45 minutes.

## What You'll Create

| Service | Monthly Cost |
|---------|-------------|
| ECS Fargate (API + Web) | ~$20/mo |
| Application Load Balancer | ~$16/mo |
| RDS PostgreSQL | $0 (free tier) |
| ECR + S3 | ~$3/mo |
| **Total** | **~$40/mo** |

---

## Step 1: Configure AWS CLI (2 min)

```bash
aws configure
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region: af-south-1
# Default output format: json

# Verify it works
aws sts get-caller-identity
```

---

## Step 2: Create ECR Repositories (2 min)

```bash
export AWS_REGION=af-south-1

aws ecr create-repository --repository-name acmp/api --region $AWS_REGION
aws ecr create-repository --repository-name acmp/web --region $AWS_REGION
```

---

## Step 3: Create IAM Roles (5 min)

```bash
# ECS Task Execution Role
cat > /tmp/ecs-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ecs-tasks.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file:///tmp/ecs-trust.json
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# ECS Infrastructure Role
cat > /tmp/ecs-infra-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ecs.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role --role-name ecsInfrastructureRoleForExpressServices --assume-role-policy-document file:///tmp/ecs-infra-trust.json
aws iam attach-role-policy --role-name ecsInfrastructureRoleForExpressServices --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRolePolicyForExpressServices
```

---

## Step 4: Create RDS Database (10 min)

```bash
# Create database (FREE TIER)
aws rds create-db-instance \
  --db-instance-identifier acmp-staging \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15 \
  --master-username acmp_admin \
  --master-user-password "ChangeThisPassword123!" \
  --allocated-storage 20 \
  --no-publicly-accessible \
  --backup-retention-period 1

# Wait for it (takes 5-10 min)
echo "Waiting for database... (this takes 5-10 minutes)"
aws rds wait db-instance-available --db-instance-identifier acmp-staging

# Get the endpoint - SAVE THIS!
aws rds describe-db-instances \
  --db-instance-identifier acmp-staging \
  --query 'DBInstances[0].Endpoint.Address' --output text
```

---

## Step 5: Create S3 Bucket (2 min)

```bash
aws s3 mb s3://acmp-uploads-staging --region $AWS_REGION
```

---

## Step 6: Store Secrets (3 min)

```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

aws secretsmanager create-secret --name acmp/staging/database-password --secret-string "ChangeThisPassword123!"
aws secretsmanager create-secret --name acmp/staging/jwt-secret --secret-string "$JWT_SECRET"
aws secretsmanager create-secret --name acmp/staging/mailchimp-api-key --secret-string "your-mailchimp-key"

# Get the ARNs - SAVE THESE!
aws secretsmanager list-secrets --query 'SecretList[?starts_with(Name, `acmp/staging`)].ARN'
```

---

## Step 7: Setup GitHub Actions (10 min)

### 7a. Create OIDC Provider

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 7b. Create GitHub Actions Role

⚠️ **Replace `YOUR_ORG` with your actual GitHub organization/username**

```bash
cat > /tmp/github-trust.json << EOF
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

aws iam create-role --role-name github-actions-ecs-role --assume-role-policy-document file:///tmp/github-trust.json
aws iam attach-role-policy --role-name github-actions-ecs-role --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
aws iam attach-role-policy --role-name github-actions-ecs-role --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess

# Get the role ARN - SAVE THIS!
echo "Role ARN: arn:aws:iam::${AWS_ACCOUNT_ID}:role/github-actions-ecs-role"
```

### 7c. Configure GitHub Repository

Go to: **GitHub Repo → Settings → Secrets and variables → Actions**

**Add Secrets:**
```
AWS_ROLE_ARN = arn:aws:iam::<account-id>:role/github-actions-ecs-role
AWS_ACCOUNT_ID = <your-account-id>
DATABASE_PASSWORD_ARN = <from step 6>
JWT_SECRET_ARN = <from step 6>
MAILCHIMP_API_KEY_ARN = <from step 6>
```

**Add Variables:**
```
DATABASE_HOST = <rds-endpoint-from-step-4>
DATABASE_USER = acmp_admin
DATABASE_NAME = postgres
AWS_S3_BUCKET = acmp-uploads-staging
CORS_ORIGIN = *
FRONTEND_URL = https://staging.acmp.io
NEXT_PUBLIC_API_URL = https://api-staging.acmp.io
NEXT_PUBLIC_WS_URL = wss://api-staging.acmp.io
MAILCHIMP_FROM_EMAIL = noreply@atfchallenge.org
MAILCHIMP_FROM_NAME = ATF AI Challenge
```

---

## Step 8: Deploy! (10 min)

```bash
# Commit the workflow files and push to develop
git add .github/workflows/
git commit -m "Add ECS Express Mode deployment workflows"
git push origin develop
```

Go to **GitHub → Actions** tab to watch the deployment.

---

## After Deployment

Once deployed, you'll get URLs like:
- API: `https://<alb-id>.af-south-1.elb.amazonaws.com`
- Web: `https://<alb-id>.af-south-1.elb.amazonaws.com`

To add custom domains (api-staging.acmp.io), see the full README.

---

## Auto-Deploy is Now Active! 🎉

```
git push origin develop  →  Builds & Deploys Staging
git push origin main     →  Builds & Deploys Production
```

---

## Troubleshooting

**GitHub Action fails?**
- Check AWS_ROLE_ARN is correct
- Verify the GitHub org/repo in the trust policy matches

**Service won't start?**
- Check CloudWatch Logs: `/ecs/acmp-api-staging`
- Verify DATABASE_HOST is correct

**Can't connect to database?**
- ECS tasks need to be in the same VPC as RDS
- Check security groups
