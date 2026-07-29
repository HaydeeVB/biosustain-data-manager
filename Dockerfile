FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --only=production

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm install typescript ts-node --save-dev && npx tsc

EXPOSE 3000

CMD ["node", "dist/presentation/index.js"]