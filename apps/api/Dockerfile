# ==============================================================================
# ACMP API - Multi-stage Dockerfile
# Optimized for AWS App Runner deployment
# ==============================================================================

# ------------------------------------------------------------------------------
# Base stage - shared between build and production
# ------------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ------------------------------------------------------------------------------
# Dependencies stage - install only production deps for smaller final image
# ------------------------------------------------------------------------------
FROM base AS deps

# Copy workspace package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/validators/package*.json ./packages/validators/

# Install all dependencies (need devDeps for build)
RUN npm ci

# ------------------------------------------------------------------------------
# Builder stage - compile TypeScript
# ------------------------------------------------------------------------------
FROM base AS builder

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY apps/api ./apps/api
COPY packages ./packages
COPY tsconfig.base.json ./
COPY package*.json ./

# Build the API
WORKDIR /app/apps/api
RUN npm run build

# Prune dev dependencies after build
WORKDIR /app
RUN npm prune --production

# ------------------------------------------------------------------------------
# Production stage - minimal runtime image
# ------------------------------------------------------------------------------
FROM node:22-alpine AS production

WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Install runtime dependencies
RUN apk add --no-cache ffmpeg dumb-init

# Copy only production node_modules
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Use non-root user
USER nestjs

# Expose port (App Runner expects 3000 by default)
EXPOSE 3000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

# ------------------------------------------------------------------------------
# Development stage - for local development with hot reload
# ------------------------------------------------------------------------------
FROM base AS development

# Install FFmpeg for video thumbnail generation
RUN apk add --no-cache ffmpeg

# Copy workspace config
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/validators/package*.json ./packages/validators/

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY apps/api ./apps/api
COPY packages ./packages
COPY tsconfig.base.json ./

WORKDIR /app/apps/api

ENV NODE_ENV=development
EXPOSE 3001

CMD ["npm", "run", "dev"]
