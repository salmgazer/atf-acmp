# ATF ACMP Deployment Guide

This guide covers deploying the ATF AI-Challenge Management Platform (ACMP) to production using Railway.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Railway Deployment](#railway-deployment)
4. [Database Setup](#database-setup)
5. [S3 Storage Setup](#s3-storage-setup)
6. [Firebase Setup](#firebase-setup)
7. [Redis Setup](#redis-setup)
8. [DNS Configuration](#dns-configuration)
9. [SSL Certificates](#ssl-certificates)
10. [Post-Deployment Verification](#post-deployment-verification)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- A [Railway](https://railway.app) account
- An AWS account (for S3 storage)
- A Firebase project (for authentication)
- Domain name (optional, for custom domain)
- Access to the ACMP Git repository

---

## Environment Variables

### Required Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3001

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/acmp_production

# JWT Authentication
JWT_SECRET=your-secure-jwt-secret-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# AWS S3 Storage
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=acmp-production-files

# Redis (for queues and caching)
REDIS_URL=redis://default:password@host:6379

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@acmp.example.com

# CORS
CORS_ORIGINS=https://acmp.example.com,https://admin.acmp.example.com

# OpenAI (for AI evaluations)
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview

# GitHub (for repository analysis)
GITHUB_TOKEN=ghp_your-github-token
```

### Optional Environment Variables

```bash
# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# Logging
LOG_LEVEL=info

# Session Security
SESSION_SECRET=your-session-secret

# File Upload Limits
MAX_FILE_SIZE=10485760  # 10MB in bytes
```

---

## Railway Deployment

### Step 1: Create a New Project

1. Log in to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select the ACMP repository

### Step 2: Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically provision a PostgreSQL instance
4. Copy the `DATABASE_URL` from the Variables tab

### Step 3: Add Redis

1. Click "New" → "Database" → "Redis"
2. Railway will provision a Redis instance
3. Copy the `REDIS_URL` from the Variables tab

### Step 4: Configure Environment Variables

1. Select your API service
2. Go to "Variables" tab
3. Add all required environment variables listed above
4. Railway will automatically redeploy when variables are updated

### Step 5: Configure Build Settings

In your service settings, configure:

```yaml
Build Command: npm run build
Start Command: npm run start:prod
Root Directory: apps/api
```

### Step 6: Deploy

1. Push to the connected branch (typically `main` or `production`)
2. Railway will automatically build and deploy
3. Monitor the deployment logs for any errors

---

## Database Setup

### Running Migrations

After the initial deployment, run database migrations:

```bash
# Via Railway CLI
railway run npm run migration:run

# Or connect to the Railway shell
railway shell
npm run migration:run
```

### Migration Commands

```bash
# Generate a new migration
npm run migration:generate -- src/database/migrations/MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run migration:show
```

### Database Backup

Set up automatic backups in Railway:

1. Go to your PostgreSQL service
2. Navigate to "Backups" tab
3. Enable automatic backups
4. Configure retention period (recommended: 7 days)

---

## S3 Storage Setup

### Step 1: Create S3 Bucket

1. Log in to AWS Console
2. Go to S3 service
3. Create a new bucket:
   - Name: `acmp-production-files`
   - Region: Choose closest to your users
   - Block all public access: **Enabled**

### Step 2: Configure CORS

Add CORS configuration to your bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://acmp.example.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Step 3: Create IAM User

1. Go to IAM → Users → Create User
2. Create a programmatic access user
3. Attach policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::acmp-production-files",
        "arn:aws:s3:::acmp-production-files/*"
      ]
    }
  ]
}
```

4. Save the Access Key ID and Secret Access Key

### Step 4: Configure Bucket Policy (for signed URLs)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSignedURLAccess",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::acmp-production-files/*",
      "Condition": {
        "StringLike": {
          "aws:Referer": ["https://acmp.example.com/*"]
        }
      }
    }
  ]
}
```

---

## Firebase Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select existing
3. Enable Authentication

### Step 2: Enable Authentication Methods

1. Go to Authentication → Sign-in method
2. Enable required providers:
   - Email/Password
   - Google (optional)

### Step 3: Generate Service Account Key

1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract values for environment variables:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

### Step 4: Configure Firebase for Frontend

Create `firebase-config.js` for frontend apps:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

## Redis Setup

Redis is used for:
- BullMQ job queues (AI evaluations, email sending)
- Session storage
- Rate limiting

Railway provides managed Redis. For self-hosted:

### Redis Configuration

```bash
# Connection URL format
REDIS_URL=redis://username:password@host:6379

# With TLS (recommended for production)
REDIS_URL=rediss://username:password@host:6379
```

### Redis Memory Configuration

For production, ensure adequate memory:
- Minimum: 256MB
- Recommended: 512MB for ~2500 teams

---

## DNS Configuration

### Step 1: Get Railway Domain

1. In Railway, go to your API service
2. Navigate to "Settings" → "Networking"
3. Generate a Railway domain or note the existing one

### Step 2: Configure Custom Domain

1. In Railway, add your custom domain (e.g., `api.acmp.example.com`)
2. Railway will provide DNS records to add

### Step 3: Add DNS Records

Add these records at your DNS provider:

```
Type: CNAME
Name: api
Value: your-app.up.railway.app

# For root domain
Type: A
Name: @
Value: (Railway IP addresses)
```

### Step 4: Verify Domain

1. Wait for DNS propagation (up to 48 hours)
2. Railway will automatically verify and enable the domain

---

## SSL Certificates

Railway automatically provisions SSL certificates via Let's Encrypt for:
- Railway-provided domains (`*.up.railway.app`)
- Custom domains (after DNS verification)

### Verify SSL

```bash
# Check SSL certificate
curl -vI https://api.acmp.example.com

# Verify certificate details
openssl s_client -connect api.acmp.example.com:443 -servername api.acmp.example.com
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
curl https://api.acmp.example.com/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 2. API Documentation

Visit: `https://api.acmp.example.com/api/docs`

(Note: Swagger UI is disabled in production by default)

### 3. Database Connection

```bash
railway run npm run migration:show
```

### 4. Test Authentication

```bash
curl -X POST https://api.acmp.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"test","portal":"staff"}'
```

### 5. Verify Queue Processing

Check Redis connection and queue status via admin dashboard.

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```
Error: connect ECONNREFUSED
```

**Solution:**
- Verify `DATABASE_URL` is correct
- Check PostgreSQL service is running
- Ensure IP whitelist includes Railway IPs

#### 2. Firebase Authentication Fails

```
Error: Firebase ID token has invalid signature
```

**Solution:**
- Verify `FIREBASE_PRIVATE_KEY` includes newlines (`\n`)
- Check `FIREBASE_PROJECT_ID` matches your Firebase project
- Ensure service account has required permissions

#### 3. S3 Upload Fails

```
Error: Access Denied
```

**Solution:**
- Verify IAM credentials are correct
- Check bucket policy allows the operations
- Ensure bucket name matches `AWS_S3_BUCKET`

#### 4. Redis Connection Issues

```
Error: Redis connection to host failed
```

**Solution:**
- Verify `REDIS_URL` format
- Check Redis service is running
- For TLS, use `rediss://` prefix

#### 5. CORS Errors

```
Error: CORS policy blocked
```

**Solution:**
- Add frontend domain to `CORS_ORIGINS`
- Ensure protocol matches (http vs https)
- Include all subdomains if needed

### Viewing Logs

```bash
# Railway CLI
railway logs

# Filter by service
railway logs --service api

# Follow logs
railway logs -f
```

### Rollback Deployment

1. Go to Railway Dashboard
2. Select your service
3. Go to "Deployments"
4. Click on previous successful deployment
5. Click "Rollback"

### Database Recovery

```bash
# Connect to Railway shell
railway shell

# Restore from backup
pg_restore -d $DATABASE_URL backup.dump
```

---

## Monitoring

### Health Endpoints

- `GET /api/health` - Basic health check
- `GET /api/health/db` - Database connectivity
- `GET /api/health/redis` - Redis connectivity

### Recommended Monitoring Tools

1. **Railway Metrics** - Built-in CPU, memory, network monitoring
2. **UptimeRobot** - External uptime monitoring
3. **Sentry** - Error tracking (add `SENTRY_DSN` env var)

### Alert Configuration

Set up alerts for:
- Service downtime (via UptimeRobot)
- High error rates (via Sentry)
- Resource usage (via Railway)

---

## Security Checklist

- [ ] All secrets stored as environment variables
- [ ] `NODE_ENV=production` is set
- [ ] CORS origins restricted to known domains
- [ ] Rate limiting enabled
- [ ] Database credentials rotated from defaults
- [ ] S3 bucket is not publicly accessible
- [ ] Firebase rules configured properly
- [ ] SSL/TLS enabled for all connections
- [ ] Regular security updates scheduled

---

## Support

For deployment issues:
1. Check Railway status: https://status.railway.app
2. Review Railway documentation: https://docs.railway.app
3. Contact ATF technical team

---

*Last updated: July 2026*
