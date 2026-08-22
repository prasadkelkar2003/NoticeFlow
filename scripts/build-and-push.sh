#!/usr/bin/env bash
set -euo pipefail

# Configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-prasadkelkar2003}"
IMAGE_NAME="notice-flow-api"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo 'v1')}"
FULL_IMAGE_URI="${DOCKER_USERNAME}/${IMAGE_NAME}"

echo "=========================================="
echo "Starting Build & Push to Docker Hub"
echo "Image Target: ${FULL_IMAGE_URI}:${IMAGE_TAG}"
echo "=========================================="

# Step 1: Docker Hub Authentication
if [ -n "${DOCKER_PASSWORD:-}" ]; then
  echo "[1/4] Logging into Docker Hub via environment variables..."
  echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_USERNAME}" --password-stdin
else
  echo "[1/4] Ensuring Docker Hub session is active..."
fi

# Step 2: Build Image
echo "[2/4] Building Docker Image..."
docker build -t "${FULL_IMAGE_URI}:${IMAGE_TAG}" -t "${FULL_IMAGE_URI}:latest" -f app/Dockerfile app/

# Step 3: Push to Docker Hub
echo "[3/4] Pushing tagged images..."
docker push "${FULL_IMAGE_URI}:${IMAGE_TAG}"
docker push "${FULL_IMAGE_URI}:latest"

echo "=========================================="
echo "Successfully pushed: ${FULL_IMAGE_URI}:${IMAGE_TAG}"
echo "=========================================="
