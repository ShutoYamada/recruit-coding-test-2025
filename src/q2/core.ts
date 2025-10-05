// src/q2/core.ts

// タイムゾーンの種類: JST=日本標準時, ICT=インドシナ時間
export type TZ = "jst" | "ict";

// 1行のログを表す型
export type Row = {
  timestamp: string; // ISO8601 UTC (例: "2025-10-01T12:34:56Z")
  userId: string; // ユーザID
  path: string; // アクセスパス
  status: number; // HTTPステータスコード
  latencyMs: number; // レイテンシ (ms)
};

// 集計オプション
export type Options = {
  from: string; // 集計開始日 (UTC基準, "YYYY-MM-DD")
  to: string; // 集計終了日 (UTC基準, "YYYY-MM-DD")
  tz: TZ; // 出力するタイムゾーン
  top: number; // 日ごとの上位N件を出力
};

// 集計結果の出力形式
export type Output = Array<{
  date: string; // タイムゾーン変換後の日付 (YYYY-MM-DD)
  path: string; // アクセスパス
  count: number; // 件数
  avgLatency: number; // 平均レイテンシ (四捨五入)
}>;

// 集計処理のエントリーポイント
export const aggregate = (lines: string[], opt: Options): Output => {
  const rows = parseLines(lines); // CSV文字列 → Row[]
  const filtered = filterByDate(rows, opt.from, opt.to); // 日付で絞り込み
  const grouped = groupByDatePath(filtered, opt.tz); // 日付+パスで集計
  const ranked = rankTop(grouped, opt.top); // 上位N件を抽出
  return ranked;
};

// CSV行をパースして Row[] に変換
export const parseLines = (lines: string[]): Row[] => {
  const out: Row[] = [];
  for (const raw of lines) {
    if (!raw || !raw.trim()) continue; // 空行スキップ
    const parts = raw.split(",").map((s) => s.trim());
    if (parts.length !== 5) continue; // 項目数が足りない行はスキップ
    const [timestamp, userId, path, statusStr, latencyStr] = parts;
    if (!timestamp || !userId || !path) continue; // 必須項目が欠けていればスキップ
    const status = Number(statusStr);
    const latencyMs = Number(latencyStr);
    // 数値変換に失敗すれば壊れ行としてスキップ
    if (isNaN(status) || isNaN(latencyMs)) continue;
    // timestamp が不正ならスキップ
    if (Number.isNaN(Date.parse(timestamp))) continue;

    // 正常行のみ Row として push
    out.push({
      timestamp,
      userId,
      path,
      status,
      latencyMs,
    });
  }
  return out;
};

// 日付範囲でフィルタリング (UTC基点)
const filterByDate = (rows: Row[], from: string, to: string): Row[] => {
  const fromT = Date.parse(from + "T00:00:00Z"); // その日の 0時
  const toT = Date.parse(to + "T23:59:59Z"); // その日の 23:59:59
  return rows.filter((r) => {
    const t = Date.parse(r.timestamp);
    return t >= fromT && t <= toT;
  });
};

// UTC時刻文字列を tz のローカル日付 (YYYY-MM-DD) に変換
const toTZDate = (utcIso: string, tz: TZ): string => {
  const t = new Date(utcIso);
  const offsetHours = tz === "jst" ? 9 : 7; // JST=UTC+9, ICT=UTC+7
  const local = new Date(t.getTime() + offsetHours * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = (local.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = local.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// 日付+パスで集計 (件数・平均レイテンシ)
const groupByDatePath = (rows: Row[], tz: TZ) => {
  const map = new Map<string, { sum: number; cnt: number }>();
  for (const r of rows) {
    const date = toTZDate(r.timestamp, tz); // タイムゾーン変換後の日付
    const key = `${date}\u0000${r.path}`; // 複合キー
    const cur = map.get(key) || { sum: 0, cnt: 0 };
    cur.sum += r.latencyMs;
    cur.cnt += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries()).map(([k, v]) => {
    const [date, path] = k.split("\u0000");
    return { date, path, count: v.cnt, avgLatency: Math.round(v.sum / v.cnt) };
  });
};

// 日ごとの上位N件を抽出 (count降順 → path昇順)
// さらに最終出力は日付昇順で安定ソート
const rankTop = (
  items: { date: string; path: string; count: number; avgLatency: number }[],
  top: number
) => {
  if (!top || top <= 0) return [];
  // 日付ごとにグルーピング
  const byDate = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byDate.get(it.date) || [];
    arr.push(it);
    byDate.set(it.date, arr);
  }
  const out: typeof items = [];
  for (const [, arr] of byDate) {
    // 件数降順 → path昇順 でソート
    arr.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
    out.push(...arr.slice(0, top)); // 上位N件だけ残す
  }
  // 出力順を安定化: 日付ASC → 件数DESC → pathASC
  out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      b.count - a.count ||
      a.path.localeCompare(b.path)
  );
  return out;
};
