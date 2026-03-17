FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune @hearsay/web --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @hearsay/web build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 web && adduser --system --uid 1001 web
COPY --from=builder --chown=web:web /app/apps/web/.output ./.output
USER web

ENV PORT=3000
EXPOSE $PORT

CMD ["node", ".output/server/index.mjs"]
