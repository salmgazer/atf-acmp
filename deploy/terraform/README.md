# ACMP Infrastructure - Terraform

## Quick Start

### 1. Install Terraform
```bash
brew install terraform
```

### 2. Configure AWS CLI
```bash
aws configure
# Region: eu-central-1
```

### 3. Create your tfvars file
```bash
cd deploy/terraform
cp staging.tfvars.example staging.tfvars
# Edit staging.tfvars with your values
```

### 4. Initialize and Apply
```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan -var-file=staging.tfvars

# Apply (creates all resources)
terraform apply -var-file=staging.tfvars
```

### 5. Copy outputs to GitHub
After apply, Terraform outputs the values you need for GitHub Actions:
```bash
terraform output github_secrets
terraform output github_variables
```

Add these to: **GitHub → Repo → Settings → Secrets and variables → Actions**

---

## Commands

```bash
# Create/update infrastructure
terraform apply -var-file=staging.tfvars

# Preview changes
terraform plan -var-file=staging.tfvars

# Destroy everything (clean teardown)
terraform destroy -var-file=staging.tfvars

# Show current state
terraform show

# List resources
terraform state list
```

---

## Switching Environments

```bash
# Staging
terraform apply -var-file=staging.tfvars

# Production (separate state recommended)
terraform apply -var-file=production.tfvars
```

For production, consider using separate state files or workspaces.

---

## What Gets Created

| Resource | Staging | Production |
|----------|---------|------------|
| ECR Repositories | 2 (api, web) | 2 |
| RDS PostgreSQL | db.t3.micro | db.t3.medium |
| S3 Bucket | 1 | 1 |
| IAM Roles | 3 | 3 |
| Secrets Manager | 3 secrets | 3 secrets |
| Security Groups | 1 | 1 |

---

## Cost Estimate

| Resource | Staging/mo | Production/mo |
|----------|-----------|---------------|
| RDS db.t3.micro | $0 (free tier) | - |
| RDS db.t3.medium | - | ~$50 |
| ECS Fargate | ~$20 | ~$80 |
| ALB | ~$16 | ~$16 |
| S3 + ECR | ~$3 | ~$5 |
| Secrets Manager | ~$1 | ~$1 |
| **Total** | **~$40** | **~$150** |

---

## Teardown

To completely remove all resources:
```bash
terraform destroy -var-file=staging.tfvars
```

Type `yes` when prompted. This removes everything created by Terraform.

⚠️ **Warning**: This deletes the database and all data. Back up first if needed.
