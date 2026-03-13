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

# Build args — required at build time for Next.js to inline into server bundles.
# NEVER set defaults here — require explicit values.
ARG ANTHROPIC_API_KEY
ARG JWT_SECRET
ENV ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ENV JWT_SECRET=$JWT_SECRET

RUN npm run build

# --- Stage 3: Production runner ---
# Use Debian-based image for Playwright browser compatibility (alpine lacks glibc)
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install musl (for Alpine-compiled better-sqlite3) + Playwright system deps + Chromium
RUN apt-get update && \
    apt-get install -y musl && \
    npx playwright install --with-deps chromium && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Playwright browsers to nextjs user's cache (installed as root above)
RUN cp -r /root/.cache/ms-playwright /home/nextjs/.cache/ms-playwright && \
    chown -R nextjs:nodejs /home/nextjs/.cache

# Create data directory for SQLite and set permissions
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
VOLUME /app/data
ENV DB_PATH=/app/data/supremacy.db

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
