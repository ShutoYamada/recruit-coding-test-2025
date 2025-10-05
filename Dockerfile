# --- builder ---
FROM node:lts-slim AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build


# --- runtime ---
FROM node:lts-slim AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
# デフォルトは Q2 の CLI を起動（引数で上書き可能）
# CMD ["node", "dist/main.js"]
ENTRYPOINT ["node", "dist/q2/main.js"]