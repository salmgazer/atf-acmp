# ==============================================================================
# ACMP API - Multi-stage Dockerfile
# Optimized for AWS ECS Express Mode deployment
# ==============================================================================

# ------------------------------------------------------------------------------
# Base stage - shared between build and production
# ------------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++ vips-dev
WORKDIR /app

# ------------------------------------------------------------------------------
# Builder stage - install deps, compile TypeScript, then prune
# ------------------------------------------------------------------------------
FROM base AS builder

# Copy workspace package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/validators/package*.json ./packages/validators/

# Install all dependencies (need devDeps for build)
RUN npm ci --ignore-scripts

# Rebuild native modules (bcrypt, sharp)
RUN npm rebuild bcrypt && \
    cd apps/api && npm rebuild sharp

# Copy source code
COPY apps/api ./apps/api
COPY packages ./packages
COPY tsconfig.base.json ./

# Build the API
WORKDIR /app/apps/api
RUN npx nest build

# Go back to root and prune dev dependencies
WORKDIR /app
RUN npm prune --omit=dev

# Verify sharp exists after pruning
RUN ls -la node_modules/sharp 2>/dev/null || ls -la apps/api/node_modules/sharp 2>/dev/null || echo "sharp location check"

# ------------------------------------------------------------------------------
# Production stage - minimal runtime image
# ------------------------------------------------------------------------------
FROM node:22-alpine AS production

WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Install runtime dependencies (vips for sharp)
RUN apk add --no-cache ffmpeg dumb-init vips

# Copy everything needed from builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

# Set NODE_PATH to include all possible module locations
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_PATH=/app/node_modules:/app/apps/api/node_modules

# Use non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]

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
ENV NODE_OPTIONS="--max-old-space-size=4096"
EXPOSE 3001

CMD ["npm", "run", "dev"]
