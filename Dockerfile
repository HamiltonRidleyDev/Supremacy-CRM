# --- Stage 1: Install dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# --- Stage 2: Build the application ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args for Next.js build (these get inlined into client bundles)
# Pass via docker compose build --build-arg or in docker-compose.yml
ARG ANTHROPIC_API_KEY=""
ARG JWT_SECRET="supremacy-bjj-production-secret"
ENV ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ENV JWT_SECRET=$JWT_SECRET

RUN npm run build

# --- Stage 3: Production runner ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create data directory for SQLite and set permissions
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
VOLUME /app/data
ENV DB_PATH=/app/data/supremacy.db

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
