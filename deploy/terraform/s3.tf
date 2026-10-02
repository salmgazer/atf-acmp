# ==============================================================================
# S3 Bucket for File Uploads
# ==============================================================================

resource "aws_s3_bucket" "uploads" {
  bucket = "acmp-uploads-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = var.environment == "production" ? [
      "https://acmp.io",
      "https://www.acmp.io",
      "https://api.acmp.io"
    ] : [
      "https://staging.acmp.io",
      "https://api-staging.acmp.io",
      "http://localhost:3000",
      "http://localhost:3001"
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  
  versioning_configuration {
    status = var.environment == "production" ? "Enabled" : "Disabled"
  }
}

# Server-side encryption for S3 bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}
