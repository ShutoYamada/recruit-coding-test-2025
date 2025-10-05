# ---- ステージ1: ビルド ----
# ビルド用に完全なNode.jsイメージを使用
FROM node:20-slim AS builder

WORKDIR /app

# パッケージ管理ファイルをコピーして依存関係をインストール
# Dockerレイヤーキャッシュを活用するために、これらのファイルだけを先にコピーする
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# 全てのソースコードをコピー
COPY . .

# TypeScriptをJavaScriptにビルド
RUN pnpm build

# ---- ステージ2: 本番 ----
# アプリケーション実行用により軽量なイメージを使用
FROM node:20-slim

WORKDIR /app

# ビルダーステージから依存関係をコピー
COPY --from=builder /app/node_modules ./node_modules
# ビルダーステージからビルド済みのコードをコピー
COPY --from=builder /app/dist ./dist

# アプリケーションを実行するデフォルトコマンド
# --file, --fromなどのパラメータは `docker run` 実行時に渡される
ENTRYPOINT ["node", "./dist/q2/main.js"]

