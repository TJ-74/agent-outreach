#!/usr/bin/env bash
# Build the backend image and push to AWS ECR.
# Usage:
#   ./scripts/push-ecr.sh
#   REPO_NAME=my-backend AWS_REGION=us-east-1 ./scripts/push-ecr.sh
#   ECR_URI=123456789.dkr.ecr.us-east-1.amazonaws.com/agent-outreach-backend ./scripts/push-ecr.sh
#
# Requires: Docker, AWS CLI configured with permissions for ECR.

set -e

REPO_NAME="${REPO_NAME:-agent-outreach-backend}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

if [ -n "$ECR_URI" ]; then
  ECR_REPO="$ECR_URI"
  # Extract region from URI (e.g. dkr.ecr.us-east-1.amazonaws.com -> us-east-1)
  if [ -z "$AWS_REGION" ] && [[ "$ECR_URI" =~ \.dkr\.ecr\.([^.]+)\.amazonaws\.com ]]; then
    AWS_REGION="${BASH_REMATCH[1]}"
  fi
else
  AWS_REGION="${AWS_REGION:-us-east-1}"
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  ECR_REPO="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"
fi
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "Building image..."
docker build -t "$REPO_NAME:$IMAGE_TAG" .

echo "Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${ECR_REPO%%/*}"

echo "Tagging and pushing $ECR_REPO:$IMAGE_TAG ..."
docker tag "$REPO_NAME:$IMAGE_TAG" "$ECR_REPO:$IMAGE_TAG"
docker push "$ECR_REPO:$IMAGE_TAG"

echo "Done. Image: $ECR_REPO:$IMAGE_TAG"
