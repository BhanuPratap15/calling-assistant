# syntax=docker/dockerfile:1
# =====================================================================
# Calling CRM — Web image (Next.js standalone). Build context = repo root:
#   docker build -f apps/web/Dockerfile -t crm-web .
# =====================================================================

ARG NODE_IMAGE=node:24-alpine

# ---------- 1) build ----------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @crm/web --include-workspace-root=false --ignore-scripts
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
# Production me Nginx /api ko seedha API container pe bhejta hai; ye sirf fallback rewrite ke liye
ARG API_URL=http://api:4000
ENV API_URL=${API_URL}
RUN npm run build -w @crm/web

# ---------- 2) runtime: .next/standalone (~45MB, poora node_modules nahi) ----------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
