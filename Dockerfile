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
# Use ENTRYPOINT instead of CMD to make it easier to pass arguments
# This allows: docker run image --file=... --from=...
ENTRYPOINT ["node", "dist/q2/main.js"]
