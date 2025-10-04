# --- base layer with pnpm enabled ---
FROM node:lts-slim AS base
WORKDIR /app
RUN corepack enable

# --- builder ---
FROM base AS builder
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist
# デフォルトは Q2 の CLI を起動（引数で上書き可能）
ENTRYPOINT ["node", "./dist/q2/main.js"]
