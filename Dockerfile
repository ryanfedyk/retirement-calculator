# Multi-stage build for Cloud Run

# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
# Set API URL to relative path (empty string) so it uses the same host
ENV VITE_API_BASE_URL=""
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --include=dev
COPY server/ ./
COPY --from=frontend-builder /app/dist ./public

# Expose port
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Start command
CMD ["npx", "ts-node", "index.ts"]
