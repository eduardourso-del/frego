# Move Dockerfile context to repo root for monorepo installs.
# Usage: gcloud builds submit --tag ... --file services/api/Dockerfile .

FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY db/package.json ./db/
COPY packages/tokens/package.json ./packages/tokens/
COPY services/api/package.json ./services/api/
RUN pnpm install --filter @frego/api...

FROM deps AS build
COPY db ./db
COPY packages/tokens ./packages/tokens
COPY services/api ./services/api
RUN pnpm --filter @frego/db generate \
 && pnpm --filter @frego/api build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=build /app /app
WORKDIR /app/services/api
EXPOSE 8080
CMD ["node", "dist/index.js"]
