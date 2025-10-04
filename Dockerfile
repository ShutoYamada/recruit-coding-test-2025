# --- Stage 1: Builder ---
FROM node:lts-slim AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

RUN pnpm build


# --- Stage 2: Runtime ---
FROM node:lts-slim AS runtime
WORKDIR /app

COPY --from=builder /app/dist ./dist


ENTRYPOINT ["node", "dist/q2/main.js"]
