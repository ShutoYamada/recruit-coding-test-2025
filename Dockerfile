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
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod
RUN pnpm add -g tsx
COPY src ./src
CMD ["pnpm", "q2:run"]
