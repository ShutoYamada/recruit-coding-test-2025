# Q1開発環境セットアップガイド

このドキュメントは、Q1（映画館の券売機CLI）の開発環境をセットアップし、初期テストを実行するための手順を説明します。

## 必要な環境

- **Node.js**: バージョン 20 以上
- **pnpm**: パッケージマネージャー
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
Done in 1.1s using pnpm v10.18.0
```

### 4. 開発環境の検証

#### TypeScriptの型チェック

```powershell
pnpm typecheck
```

エラーが出力されなければ成功です。

#### ESLintによるコードチェック

```powershell
pnpm lint
```

エラーや警告が出力されなければ成功です。

### 5. Q1テストの実行

#### 初期テスト状況の確認

```powershell
pnpm test
```

期待される出力：
```
 ✓ src/q1/solve.spec.ts (16)
 ✓ src/q2/core.spec.ts (2)

 Test Files  2 passed (2)
      Tests  2 passed | 15 skipped | 1 todo (18)
```

**補足**: 現時点では、いくつかのテストが `it.skip` により無効化されています。

#### Q1 CLIの動作確認

```powershell
echo "Adult,G,10:00,1:00,A-1" | pnpm q1:run
```

期待される出力：
```
1800円
```

## Q1開発で使用するコマンド

| コマンド | 説明 |
|---------|------|
| `pnpm test` | 全テストを実行（Q1テストも含む） |
| `pnpm dev` | テストをwatchモードで実行 |
| `pnpm q1:run` | Q1 CLIを実行 |
| `pnpm typecheck` | TypeScript型チェック |
| `pnpm lint` | ESLintチェック |

## Q1プロジェクト構造

```
src/q1/
├─ README.md              # Q1の仕様書
├─ cli.ts                # Q1のCLIエントリーポイント
├─ solve.ts              # Q1の実装コード
├─ solve.spec.ts         # Q1のテストケース
└─ SETUP_GUIDE_JP.md     # このセットアップガイド
```
