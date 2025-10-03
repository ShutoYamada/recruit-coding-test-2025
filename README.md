# Coding Test 2025

- このリポジトリをFork して小さなコミットで開発し、q1,q2が完了したら PR を作成してください。
  - eg. `<YourGithubAccount>/recruit-coding-test-2025`
- Node 20 / pnpm 推奨
- `.devcontainer`フォルダがありますが、DevContainerを使わなくてもコーディングは可能です
  - DevContainerの情報については[ドキュメント](https://containers.dev/)を参照してください
  - DevContainerを使う場合は以下の環境を用意してください
    - [WSL(Windows Subsystem for Linux)](https://learn.microsoft.com/ja-jp/windows/wsl/install)
    - Vscodeの拡張機能[Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- CI は `typecheck`/`lint`/`test`/`docker build` を実行します。

# ディレクトリ構成

```
repo/
  ├─ .github/workflows/ci.yml
  ├─ .devcontainer/devcontainer.json
  ├─ Dockerfile # Q2 の docker build 確認用（CI で build のみ）
  ├─ package.json
  ├─ pnpm-lock.yaml
  ├─ tsconfig.json
  ├─ vitest.config.ts
  ├─ eslint.config.js
  ├─ .prettierrc
  ├─ README.md
  └─ src/
      ├─ q1/
      │   ├─ README.md
      │   ├─ cli.ts
      │   ├─ solve.ts
      │   └─ solve.spec.ts
      └─ q2/
          ├─ README.md
          ├─ main.ts
          ├─ core.ts
          ├─ core.spec.ts
          └─ sample.csv
```

## Q1: 映画館の券売機（CLI）

- 入力: 標準入力の複数行。出力: 標準出力。
- 実行: `pnpm q1:run`
- 仕様詳細は `src/q1/README.md` を参照。
- q1では「テストケースに合格するように、自分でロジックを実装する能力」をテストします

## Q2: アクセスログ集計 & Docker

- CLI 実行: `pnpm q2:run --file=src/q2/sample.csv --from=2025-01-01 --to=2025-01-31 --tz=jst --top=3`
- 仕様詳細は `src/q2/README.md` を参照。
- q2では「ロジックから、テストケースとして足りないものを考える能力」をテストします

## テスト

- `pnpm test` で公開テストが実行されます（初期は一部 `it.skip`）。

## 提出方法
- q1, q2がすべて完了したら以下の手順に従ってPullRequestを作成してください

1. "Contributes"をクリック
![step_1](https://github.com/ShutoYamada/recruit-coding-test-2025/blob/main/docs/finished_step_1.png)

2. "Open Pull Request"をクリック
![step_2](https://github.com/ShutoYamada/recruit-coding-test-2025/blob/main/docs/finished_step_2.png)

3. "coding exam finished <Your SCP ID>"とタイトルに入力して、"Create Pull Request"をクリック
![step_3](https://github.com/ShutoYamada/recruit-coding-test-2025/blob/main/docs/finished_step_3.png)

## 連絡先

コーディングテストに関して不明点があったら、以下に連絡をしてください。

email: pgtest@mlist.sbs-infosys.co.jp

## 最後に

```
“Great engineers explain their choices — and leave the code better than they found it.”
```
