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
    allowed_origins = ["*"]  # Will be restricted in production
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  
  versioning_configuration {
    status = var.environment == "production" ? "Enabled" : "Disabled"
  }
}
