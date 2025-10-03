# Q2: アクセスログ集計 & Docker

## 入力 CSV（UTC）

`timestamp,userId,path,status,latencyMs`

例: `2025-01-03T10:12:00Z,u42,/api/orders,200,123`

## 出力仕様

- 出力は **JSON 配列**。各要素は次の形：
  ```json
  { "date": "YYYY-MM-DD", "path": "/api/...", "count": 123, "avgLatency": 150 }
  ```
- `date` は `--tz=jst|ict` を適用後の日付。
- `avgLatency` は平均遅延の 四捨五入整数。
- **上位Nは「日付ごと」**に `count` 降順で抽出。件数が同じ場合は `path` 昇順。
- 最終出力の 並び順：`date` 昇順 → `count` 降順 → `path` 昇順。

## 要件（CLI）

- 期間フィルタ: `--from=YYYY-MM-DD` / `--to=YYYY-MM-DD`（両端含む / UTC 起点）
- タイムゾーン: `--tz=jst|ict` で 集計日付 を変換（JST=UTC+9, ICT=UTC+7）
- 集計: `date × path` ごとの 件数 と 平均遅延
- 上位 N: `--top=5` で件数順に上位のみ出力（日付ごと）
- 壊れた行・不足カラムは スキップ（無視）

## 実行例

```bash
pnpm q2:run --file=src/q2/sample.csv --from=2025-01-01 --to=2025-01-31 --tz=jst --top=3
```

## テスト

- `q2`では自分でテストケースを考える能力を測ります
- `src/q2/core.spec.ts` を参照（初期は `it.todo` が含まれます）
- 自分でテストケース・テストデータを追加してください（推奨観点は下記）。

### 推奨テスト観点

1. パース：壊れた行をスキップ（カラム不足/非数）
2. 期間フィルタ：`from/to` の 境界含む / 範囲外除外
3. タイムゾーン：`UTC→JST/ICT` の変換で 日付跨ぎが正しい
4. 集計：`date×path` の件数・平均が合う
5. 上位N：日付ごとに `count` 降順、同数は `path` 昇順
6. 出力順：`date ASC, count DESC, path ASC` の 決定的順序
7. サンプル拡張：同一日複数パス/同数タイ/大きめデータ

## Docker

- `docker build .` が通ること（検証はCIで行います）
- 画像は マルチステージ推奨、`.dockerignore` で不要物を除外
- 実行例：

```bash
docker run --rm -v "$PWD/src/q2:/data" recruit-assignments-2025 \
  --file=/data/sample.csv --from=2025-01-01 --to=2025-01-31 --tz=jst --top=3
```

## 採点基準

q2のコードはscoreの最大値を50とし、以下の観点で採点配分を行います。

- (10pt) Docker/実行性：Dockerfileの妥当性（マルチステージ/不要物除外/実行手順通り動作）、CLIの引数取り回し、再現性
- (15pt) テスト：上記「推奨テスト観点」を概ね網羅（境界値・並び順の完全一致を含む）。自作ケースの妥当性・説明
- (20pt) 正確性：期間の両端含む判定、`TZ`変換、`date×path` 集計、日付ごとの上位N、最終の決定的順序、`avgLatency` の丸め
- (5pt) コード品質：責務分割（パース/フィルタ/グルーピング/ランキング）、型の厳密さ、コメントの明瞭さ
