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

### 6. Dockerの確認

#### Dockerバージョンの確認

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

#### Dockerイメージのビルド

```powershell
docker build -t recruit-assignments-2025 .
```

期待される出力（最終行）：
```
=> => naming to docker.io/library/recruit-assignments-2025:latest
```

#### DockerでQ2実行テスト

```powershell
docker run --rm -v "${PWD}/src/q2:/data" recruit-assignments-2025 --file=/data/sample.csv --from=2025-01-01 --to=2025-01-31 --tz=jst --top=3
```

期待される出力：
```json
[{"date":"2025-01-03","path":"/api/orders","count":2,"avgLatency":150},{"date":"2025-01-03","path":"/api/users","count":1,"avgLatency":90},{"date":"2025-01-04","path":"/api/orders","count":1,"avgLatency":110}]
```

## Q2開発で使用するコマンド

| コマンド | 説明 |
|---------|------|
| `pnpm test src/q2` | Q2テストを実行 |
| `pnpm dev` | テストをwatchモードで実行 |
| `pnpm q2:run` | Q2 CLIを実行 |
| `pnpm typecheck` | TypeScript型チェック |
| `pnpm build` | TypeScriptビルド |
| `docker build -t recruit-assignments-2025 .` | Dockerイメージビルド |
| `docker run --rm -v "${PWD}/src/q2:/data" recruit-assignments-2025` | Docker実行 |

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



# 自分のCSVファイルを使用（パスを適切に変更）
docker run --rm -v "/path/to/your/data:/data" recruit-assignments-2025 \
  --file=/data/your-file.csv --from=2025-01-01 --to=2025-12-31 --tz=jst --top=10
```
