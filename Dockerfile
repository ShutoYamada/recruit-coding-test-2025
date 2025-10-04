# --- builder ---
FROM node:lts-slim AS builder
WORKDIR /app

# pnpmを有効化
RUN corepack enable

# 依存関係ファイルをコピーして先にインストール（レイヤーキャッシュ最適化）
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ソースコードとビルド設定をコピー
COPY tsconfig.json vitest.config.ts eslint.config.js ./
COPY src ./src

# TypeScriptプロジェクトをビルド
RUN pnpm build

# プロダクション依存関係のみインストール（runtime用）
RUN pnpm install --prod --frozen-lockfile


# --- runtime stage ---
FROM node:lts-slim AS runtime
WORKDIR /app

# セキュリティのために非rootユーザーを作成
RUN groupadd -r appuser && useradd -r -g appuser appuser

# ビルド成果物と本番依存関係をコピー
COPY --from=builder --chown=appuser:appuser /app/dist ./dist
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/package.json ./package.json

# 非rootユーザーに切り替え
USER appuser

# ヘルスチェック追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1

# デフォルトでQ2のCLIを起動（引数で上書き可能）
ENTRYPOINT ["node", "dist/q2/main.js"]
