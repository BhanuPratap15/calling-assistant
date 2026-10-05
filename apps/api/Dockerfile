# syntax=docker/dockerfile:1
# =====================================================================
# Calling CRM — API image (NestJS). Build context = repo root:
#   docker build -f apps/api/Dockerfile -t crm-api .
# Stages:  build (compile)  →  migrate (prisma migrate deploy / seed)  →  runtime (chhota image)
# =====================================================================

ARG NODE_IMAGE=node:24-alpine

# ---------- 1) build: saari dependencies + TypeScript compile ----------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
# Pehle sirf package files → dependency layer cache (code badle to npm ci dobara nahi)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @crm/api --include-workspace-root=false --ignore-scripts
COPY apps/api apps/api
# prisma generate ko DB nahi chahiye, bas config ke liye ek URL
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run db:generate -w @crm/api \
 && npm run build -w @crm/api

# ---------- 2) migrate: DB migrations / seed (Prisma CLI chahiye — isliye build stage se) ----------
#   docker compose run --rm migrate                    → prisma migrate deploy
#   docker compose run --rm migrate npx prisma db seed → pehla Super Admin
FROM build AS migrate
WORKDIR /app/apps/api
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------- 3) runtime: sirf production dependencies + compiled dist ----------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# --ignore-scripts: postinstall (prisma generate) nahi — generated client dist me compile ho chuka hai.
# Prisma CLI / Studio, TypeScript, React (sirf @prisma/client ki optional peer chain se aate hain)
# runtime pe nahi chahiye → hata do (image ~200MB chhota). Verified: API, import, reports chalte hain.
RUN npm ci --workspace @crm/api --include-workspace-root=false --omit=dev --ignore-scripts \
 && rm -rf node_modules/prisma node_modules/@prisma/studio-core node_modules/@prisma/dev \
           node_modules/@electric-sql node_modules/typescript node_modules/react node_modules/react-dom \
           node_modules/effect node_modules/elkjs node_modules/@radix-ui \
 && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 4000
# Container health = API + DB + scheduler (docker ps me "healthy")
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health | grep -q '"database":"up"' || exit 1
CMD ["node", "dist/main"]
