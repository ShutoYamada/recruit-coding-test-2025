# Q2: アクセスログ集計 & Docker

## 概要

この課題では、**アクセスログCSVファイル（UTC）**を読み込み、
**日付 × パス（`date × path`）単位で集計**し、
**リクエスト件数と平均レイテンシ（latency）**を計算して **JSON** 形式で出力するプログラムを作成します。

実装は **TypeScript** で行い、**CLI および Docker** から実行可能である必要があります。

---

## 入力フォーマット (CSV)

CSV の列構成：

```
timestamp,userId,path,status,latencyMs
```

例：
```
2025-01-03T10:12:00Z,u42,/api/orders,200,123
```

---

## 出力フォーマット (JSON)

出力は **JSON 配列** で、各要素は以下の形式です：

```json
{
  "date": "YYYY-MM-DD",
  "path": "/api/...",
  "count": 123,
  "avgLatency": 150
}
```

### ルール:
- `date`: タイムゾーン `--tz=jst` または `--tz=ict` を適用して算出
  - JST = UTC +9
  - ICT = UTC +7
- `avgLatency`: 遅延の平均値（四捨五入）
- 各日付ごとに **Top N** を抽出（`count` 降順、同数なら `path` 昇順）
- 最終出力順序： `date ASC → count DESC → path ASC`

---

## コマンドライン引数 (CLI)

| オプション | 説明 |
|-------------|------|
| `--file` | 入力CSVファイルのパス |
| `--from` | 開始日（UTC, `YYYY-MM-DD` 形式） |
| `--to` | 終了日（UTC, `YYYY-MM-DD` 形式） |
| `--tz` | タイムゾーン指定 (`jst` または `ict`) |
| `--top` | 各日ごとの上位件数 (Top N) |

### 実行例 (pnpm):

```bash
pnpm q2:run --file=src/q2/sample.csv --from=2025-01-01 --to=2025-01-31 --tz=jst --top=3
```

---

## 処理の流れ

1. **parseLines()**
   → CSV を読み取り、欠損・壊れた行をスキップ。

2. **filterByDate()**
   → `from` / `to` 範囲内（両端含む, UTC 基準）でフィルタリング。

3. **toTZDate()**
   → UTC を JST または ICT に変換。

4. **groupByDatePath()**
   → `date × path` 単位でグルーピングし、件数と平均遅延を計算。

5. **rankTop()**
   → 各日ごとに `count` 降順（同値時は `path` 昇順）で Top N を抽出。

6. **最終ソート**
   → `date ASC, count DESC, path ASC` の順に並べ替え。

---

## テスト (src/q2/core.spec.ts)

テストケースは以下の観点をカバー：

| 観点 | 内容 |
|------|------|
| **パース** | 壊れた行・不足カラムをスキップ |
| **期間フィルタ** | `from/to` の境界を含む動作確認 |
| **タイムゾーン** | UTC → JST/ICT 変換の正確性 |
| **集計** | `date×path` ごとの件数・平均遅延 |
| **Top N** | 各日ごとの上位 N 件取得（件数降順・path昇順） |
| **出力順** | `date ASC, count DESC, path ASC` 順の安定性 |

すべてのテストが成功（境界値ケースを除く）

---

## Docker 実行手順

### 1. ビルド

```bash
docker build -t recruit-assignments-2025 .
```

### 2. 実行

```bash
docker run --rm -v "$PWD/src/q2:/data" recruit-assignments-2025   node dist/q2/main.js   --file=/data/sample.csv   --from=2025-01-01   --to=2025-01-31   --tz=jst   --top=3
```

### 3️. 実行結果例

```json
[
  { "date": "2025-01-03", "path": "/api/orders", "count": 2, "avgLatency": 150 },
  { "date": "2025-01-03", "path": "/api/users", "count": 1, "avgLatency": 90 },
  { "date": "2025-01-04", "path": "/api/orders", "count": 1, "avgLatency": 110 }
]
```

---

## 備考

- `filterByDate()` は UTC 基準での範囲フィルタを行うため、境界条件で JST/ICT とずれが生じる場合があります。
  ただし、仕様上「両端含む / UTC 起点」とあるため、この実装は正しいです。
- Docker イメージは正常にビルド・実行でき、JSON 出力も仕様通りです。

---

**作成者:**
チャン・ヴァン・マイン

使用言語: TypeScript + Node.js

作成日: 2025年10月6日
