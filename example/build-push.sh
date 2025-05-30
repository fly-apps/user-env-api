#!/bin/bash
set -e

# Build the image for amd64
docker build --platform linux/amd64 -t flyio/ubuntu:latest .

# Push to Docker Hub
docker push flyio/ubuntu:latest 