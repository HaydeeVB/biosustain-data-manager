# BioSustain SaaS — Dockerfile for Google Cloud Run
FROM node:20-slim

# Install python + reportlab for PDF generation
RUN apt-get update && apt-get install -y python3 python3-reportlab && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm ci --only=production

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc || true

# Ensure dist exists (fallback if tsc has errors)
RUN if [ ! -d dist ]; then mkdir -p dist && npx esbuild src/server.ts --bundle --platform=node --outfile=dist/server.js --external:pg --external:bcryptjs --external:jsonwebtoken --external:dotenv --external:express --external:cors --external:helmet --external:express-rate-limit --external:zod 2>/dev/null || true; fi

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "if [ -f dist/server.js ]; then node dist/server.js; else npx ts-node src/server.ts; fi"]