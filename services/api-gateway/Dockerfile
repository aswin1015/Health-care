# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy shared types as well since compile depends on it
COPY shared/ /usr/src/shared/
COPY services/api-gateway/package*.json ./services/api-gateway/
COPY services/api-gateway/tsconfig.json ./services/api-gateway/

WORKDIR /usr/src/app/services/api-gateway
RUN npm ci

COPY services/api-gateway/src/ ./src/
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /usr/src/app/services/api-gateway

# Set production env
ENV NODE_ENV=production
ENV PORT=5000

COPY services/api-gateway/package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/services/api-gateway/dist ./dist

# Expose port
EXPOSE 5000

# Run API Gateway
CMD ["node", "dist/index.js"]
