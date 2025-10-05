/* eslint-disable @typescript-eslint/no-unused-vars */

export type Row = {
  timestamp: string;
  userId: string;
  path: string;
  status: number;
  latencyMs: number;
};

export type Options = {
  from: string;
  to: string;
  tz: 'jst' | 'ict';
  top: number;
};

export type OutputItem = {
  date: string;
  path: string;
  count: number;
  avgLatency: number;
};

export type Output = OutputItem[];

// =============================
// 1. CSV行をパース
// =============================
export const parseLines = (lines: string[]): Row[] => {
  const rows: Row[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('timestamp')) continue;

    const cols = trimmed.split(',').map((s) => s.trim());
    if (cols.length < 5) continue;

    const [timestamp, userId, path, statusStr, latencyStr] = cols;
    const status = Number(statusStr);
    const latencyMs = Number(latencyStr);
    if (!timestamp || !userId || !path) continue;
    if (Number.isNaN(status) || Number.isNaN(latencyMs)) continue;

    rows.push({ timestamp, userId, path, status, latencyMs });
  }
  return rows;
};

// =============================
// 2. タイムゾーン変換
// =============================
const convertToLocalDate = (utcIso: string, tz: 'jst' | 'ict'): string => {
  const date = new Date(utcIso);
  const offsetHours = tz === 'jst' ? 9 : 7;
  const local = new Date(date.getTime() + offsetHours * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
};

// =============================
// 3. 集計ロジック本体
// =============================
export const aggregate = (lines: string[], opt: Options): Output => {
  const rows = parseLines(lines);
  const fromTime = Date.parse(opt.from + 'T00:00:00Z');
  const toTime = Date.parse(opt.to + 'T23:59:59Z');

  // --- 日付範囲フィルタリング (UTC基準)
  const filtered = rows.filter((r) => {
    const t = Date.parse(r.timestamp);
    return t >= fromTime && t <= toTime;
  });

  // --- ローカル日付変換してグルーピング
  const grouped = new Map<string, { count: number; totalLatency: number }>();

  for (const r of filtered) {
    const date = convertToLocalDate(r.timestamp, opt.tz);
    const key = `${date}#${r.path}`;
    const prev = grouped.get(key);
    if (prev) {
      prev.count++;
      prev.totalLatency += r.latencyMs;
    } else {
      grouped.set(key, { count: 1, totalLatency: r.latencyMs });
    }
  }

  // --- 集計結果リスト化
  const results: OutputItem[] = Array.from(grouped.entries()).map(([key, val]) => {
    const [date, path] = key.split('#');
    const avgLatency = Math.round(val.totalLatency / val.count);
    return { date, path, count: val.count, avgLatency };
  });

  // --- 日ごとに Top N 選定
  const byDate = new Map<string, OutputItem[]>();
  for (const r of results) {
    const arr = byDate.get(r.date) ?? [];
    arr.push(r);
    byDate.set(r.date, arr);
  }

  const final: OutputItem[] = [];
  for (const [date, items] of Array.from(byDate.entries())) {
    items.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.path.localeCompare(b.path);
    });
    final.push(...items.slice(0, opt.top));
  }

  // --- 最終ソート（日付昇順→count降順→path昇順）
  final.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (b.count !== a.count) return b.count - a.count;
    return a.path.localeCompare(b.path);
  });

  return final;
};
