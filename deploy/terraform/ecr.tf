# ==============================================================================
# ECR Repositories
# ==============================================================================

resource "aws_ecr_repository" "api" {
  name                 = "acmp/api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "web" {
  name                 = "acmp/web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Environment release tags protect deployed images from unrelated builds.
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy     = file("${path.module}/ecr-lifecycle-policy.json")
}

resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name
  policy     = file("${path.module}/ecr-lifecycle-policy.json")
}
