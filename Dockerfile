# BioSustain SaaS — Dockerfile for Google Cloud Run
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build
RUN npm install typescript ts-node --save-dev && npx tsc

# Expose port (Cloud Run uses PORT env var)
ENV PORT=8080
EXPOSE 8080

# Start
CMD ["node", "dist/server.js"]