# Q2開発環境セットアップガイド

このドキュメントは、Q2（アクセスログ集計 & Docker）の開発環境をセットアップし、初期テストを実行するための手順を説明します。

## 必要な環境

- **Node.js**: バージョン 20 以上
- **pnpm**: パッケージマネージャー
- **Docker**: Docker Desktop
- **Windows PowerShell**: コマンド実行用

## セットアップ手順

### 1. Node.jsの確認

まず、Node.jsが正しくインストールされているか確認します：

```powershell
node --version
```

期待される出力例：
```
v22.18.0
```

### 2. pnpmのインストール

pnpmがインストールされているか確認：

```powershell
pnpm --version
```

もしpnpmがインストールされていない場合、以下のコマンドでインストールします：

```powershell
npm install -g pnpm --force
```

成功すると以下のような出力が表示されます：
```
10.18.0
```

### 3. 依存関係のインストール

プロジェクトルートディレクトリで以下のコマンドを実行：

```powershell
pnpm install
```

期待される出力：
```
Lockfile is up to date, resolution step is skipped
Already up to date
Done in 1.4s using pnpm v10.18.0
```

### 4. 開発環境の検証

#### TypeScriptの型チェック

```powershell
pnpm typecheck
```

エラーが出力されなければ成功です。

#### TypeScriptのビルド

```powershell
pnpm build
```

エラーが出力されなければ成功です。

### 5. Q2テストの実行

#### 初期テスト状況の確認

```powershell
pnpm test src/q2
```

期待される出力：
```
 ✓ src/q2/core.spec.ts (2)
   ✓ Q2 core (2)
     ✓ parseLines: skips broken rows
     ↓ aggregate basic [skipped]

 Test Files  1 passed (1)
      Tests  1 passed | 1 todo (2)
```

**補足**: 現時点では、いくつかのテストが `it.todo` により無効化されています。

#### Q2 CLIの動作確認

```powershell
pnpm q2:run --file=src/q2/sample.csv --from=2025-01-01 --to=2025-01-31 --tz=jst --top=3
```

期待される出力：
```json
[{"date":"2025-01-03","path":"/api/orders","count":2,"avgLatency":150},{"date":"2025-01-03","path":"/api/users","count":1,"avgLatency":90},{"date":"2025-01-04","path":"/api/orders","count":1,"avgLatency":110}]
```

### 6. Dockerセットアップと動作確認

#### Docker環境の確認

Docker Desktopが起動していることを確認：

```powershell
docker version
```

期待される出力例：
```
Client:
 Version:           28.4.0
 API version:       1.51
Server: Docker Desktop 4.47.0 (206054)
 Engine:
  Version:          28.4.0
```

#### Multi-stage Dockerイメージのビルド

プロジェクトルートで以下のコマンドを実行：

```powershell
docker build -t recruit-q2-2025 .
```

**ビルドプロセスの説明：**
1. **Builder Stage**: 依存関係インストール → TypeScriptビルド → 本番依存関係準備
2. **Runtime Stage**: 軽量な実行環境にビルド成果物のみコピー

期待される出力（最終行）：
```
=> => naming to docker.io/library/recruit-q2-2025:latest
```

#### Dockerイメージサイズの確認

```powershell
docker images recruit-q2-2025
```

期待される出力例：
```
REPOSITORY        TAG       IMAGE ID       CREATED          SIZE
recruit-q2-2025   latest    abc123def456   2 minutes ago    200MB
```

#### DockerでQ2実行テスト

```powershell
docker run --rm -v "${PWD}/src/q2:/data" recruit-q2-2025 --file=/data/sample.csv --from=2025-01-01 --to=2025-01-31 --tz=jst --top=3
```

期待される出力：
```json
[{"date":"2025-01-03","path":"/api/orders","count":2,"avgLatency":150},{"date":"2025-01-03","path":"/api/users","count":1,"avgLatency":90},{"date":"2025-01-04","path":"/api/orders","count":1,"avgLatency":110}]
```

#### Dockerでの応用的な使用例

**タイムゾーンICTでの実行：**
```powershell
docker run --rm -v "${PWD}/src/q2:/data" recruit-q2-2025 --file=/data/sample.csv --from=2025-01-01 --to=2025-01-31 --tz=ict --top=5
```

**カスタムCSVファイルでの実行：**
```powershell
# 1. カスタムCSVファイルを準備（例: C:\data\my-logs.csv）
# 2. ボリュームマウントでアクセス可能にする
docker run --rm -v "C:/data:/data" recruit-q2-2025 --file=/data/my-logs.csv --from=2025-01-01 --to=2025-12-31 --tz=jst --top=10
```

**異なる期間での実行：**
```powershell
docker run --rm -v "${PWD}/src/q2:/data" recruit-q2-2025 --file=/data/sample.csv --from=2025-01-03 --to=2025-01-04 --tz=jst --top=5
```

**引数なし実行（エラー確認）：**
```powershell
docker run --rm recruit-q2-2025
```

#### Dockerトラブルシューティング

**イメージビルドがキャッシュされている場合の強制リビルド：**
```powershell
docker build --no-cache -t recruit-q2-2025 .
```

**コンテナ内でのデバッグ：**
```powershell
docker run --rm -it --entrypoint /bin/bash recruit-q2-2025
```

**ログの詳細確認：**
```powershell
docker run --rm -v "${PWD}/src/q2:/data" recruit-q2-2025 --file=/data/sample.csv --from=2025-01-01 --to=2025-01-31 --tz=jst --top=3 --verbose
```

## Q2開発で使用するコマンド

### 基本開発コマンド
| コマンド | 説明 |
|---------|------|
| `pnpm test src/q2` | Q2テストを実行 |
| `pnpm dev` | テストをwatchモードで実行 |
| `pnpm q2:run` | Q2 CLIを実行 |
| `pnpm typecheck` | TypeScript型チェック |
| `pnpm build` | TypeScriptビルド |

### Dockerコマンド
| コマンド | 説明 |
|---------|------|
| `docker build -t recruit-q2-2025 .` | Multi-stage Dockerイメージビルド |
| `docker build --no-cache -t recruit-q2-2025 .` | キャッシュなしでリビルド |
| `docker images recruit-q2-2025` | イメージサイズ確認 |
| `docker run --rm -v "${PWD}/src/q2:/data" recruit-q2-2025 [options]` | Docker実行（ボリュームマウント） |
| `docker run --rm -it --entrypoint /bin/bash recruit-q2-2025` | コンテナ内デバッグ |

## Q2プロジェクト構造

```
src/q2/
├─ README.md              # Q2の仕様書
├─ main.ts               # Q2のCLIエントリーポイント
├─ core.ts               # Q2の実装コード
├─ core.spec.ts          # Q2のテストケース
├─ sample.csv            # サンプルCSVデータ
└─ SETUP_GUIDE.md        # このセットアップガイド
```



## Dockerの技術的詳細

### Multi-stage ビルドの利点
- **Builder Stage**: 開発依存関係を含む完全な環境でビルド
- **Runtime Stage**: 実行に必要な最小限のファイルのみ含む軽量イメージ
- **セキュリティ**: 非rootユーザーで実行
- **ヘルスチェック**: コンテナの健全性監視

### .dockerignoreの効果
以下のファイル/フォルダがビルドコンテキストから除外されます：
- 開発用ファイル（テスト、ドキュメント）
- ビルド成果物（dist, coverage）
- エディタ設定（.vscode, .idea）
- VCS履歴（.git）
- 依存関係キャッシュ（node_modules, .pnpm-store）

これにより、ビルド時間の短縮とセキュリティ向上が実現されます。
