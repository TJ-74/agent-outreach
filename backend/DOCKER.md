# Backend Docker & AWS ECR

## Build and run locally

```bash
cd backend
docker build -t agent-outreach-backend .
docker run -p 8000:8000 --env-file .env agent-outreach-backend
```

Or pass env vars explicitly:

```bash
docker run -p 8000:8000 \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_KEY=... \
  -e AZURE_OPENAI_API_KEY=... \
  -e AZURE_OPENAI_ENDPOINT=... \
  -e AZURE_OPENAI_DEPLOYMENT=gpt-4o \
  -e AZURE_OPENAI_MINI_DEPLOYMENT=gpt-5-mini \
  -e AZURE_OPENAI_API_VERSION=2024-12-01-preview \
  -e BRAVE_SEARCH_API_KEY=... \
  agent-outreach-backend
```

Health check: `http://localhost:8000/health`

---

## Push to AWS ECR

### Prerequisites

- Docker
- AWS CLI installed and configured (`aws configure`) with permissions for ECR

### One-time: create ECR repository

```bash
aws ecr create-repository --repository-name agent-outreach-backend --region us-east-1
```

### Option 1: Bash script (Git Bash / WSL / macOS / Linux)

From the `backend` directory:

```bash
# Defaults: repo name agent-outreach-backend, region us-east-1, tag latest
./scripts/push-ecr.sh

# Custom repo name and region
REPO_NAME=my-backend AWS_REGION=eu-west-1 ./scripts/push-ecr.sh

# Custom tag
IMAGE_TAG=v1.0.0 ./scripts/push-ecr.sh

# Full ECR URI (account id is resolved automatically otherwise)
ECR_URI=123456789012.dkr.ecr.us-east-1.amazonaws.com/agent-outreach-backend ./scripts/push-ecr.sh
```

### Option 2: PowerShell (Windows)

From the `backend` directory, after building the image:

```powershell
$AWS_REGION = "us-east-1"
$REPO_NAME = "agent-outreach-backend"
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$ECR_URI = "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO_NAME"

# Create repo if it doesn't exist (optional)
aws ecr describe-repositories --repository-names $REPO_NAME --region $AWS_REGION 2>$null
if (-not $?) { aws ecr create-repository --repository-name $REPO_NAME --region $AWS_REGION }

# Login
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $($ECR_URI -replace '/.*','')

# Build, tag, push
docker build -t "${REPO_NAME}:latest" .
docker tag "${REPO_NAME}:latest" "${ECR_URI}:latest"
docker push "${ECR_URI}:latest"
```

### After pushing

Use the image URI in ECS task definitions, EKS manifests, or other orchestrators:

```
<account-id>.dkr.ecr.<region>.amazonaws.com/agent-outreach-backend:latest
```

Environment variables (Supabase, Azure OpenAI, Brave Search) must be set in the task/container configuration; they are not baked into the image.
