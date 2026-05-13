# Cloud Run Deployment Guide

This guide covers how to deploy the full stack (React + Node.js) to Google Cloud Run using a single container.

## 1. Prerequisites

- **Google Cloud Project**: You need an active GCP project.
- **gcloud CLI**: Installed and authenticated (`gcloud auth login`).
- **Cloud Run API**: Enabled in your project.

## 2. Build and Deploy

You can deploy directly from source using `gcloud run deploy`. This command zips your code, builds it using Google Cloud Build (using the `Dockerfile`), and deploys it to Cloud Run.

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
export SERVICE_NAME="retirement-planner"

# Deploy
gcloud run deploy $SERVICE_NAME \
  --source . \
  --project $PROJECT_ID \
  --region us-central1 \
  --allow-unauthenticated
```
*Note: `--allow-unauthenticated` makes the service public. Omit this if you want it to be private/internal.*

## 3. Environment Variables

You can set environment variables during deployment or in the Cloud Console.
Relevant variables:
- `GEMINI_API_KEY`: Required for AI features.
- `PORT`: Automatically set by Cloud Run (default 8080), but our Dockerfile exposes 3000. Cloud Run will inject `PORT` env var which our server listens on.

To set secrets safely:
```bash
gcloud run services update $SERVICE_NAME \
  --set-env-vars GEMINI_API_KEY="your-key-here"
```

## 4. Local Testing

To test the container locally before deploying:

```bash
# Build the image
docker build -t retirement-planner .

# Run the container
docker run -p 3000:3000 -e GEMINI_API_KEY="your-key" retirement-planner
```
Visit `http://localhost:3000` to see the app.
