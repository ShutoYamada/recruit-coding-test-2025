type TZ = 'jst' | 'ict';

export type Row = {
  timestamp: string; // ISO8601 UTC
  userId: string;
  path: string;
  status: number;
  latencyMs: number;
};

export type Options = {
  from: string; // YYYY-MM-DD (UTC 起点)
  to: string; // YYYY-MM-DD (UTC 起点)
  tz: TZ;
  top: number;
};

export type Output = Array<{
  date: string; // tz での YYYY-MM-DD
  path: string;
  count: number;
  avgLatency: number;
}>;

export const aggregate = (lines: string[], opt: Options): Output => {
  const contentLines = lines.slice(1);
  const rows = parseLines(contentLines);
  const filtered = filterByDate(rows, opt.from, opt.to);
  const grouped = groupByDatePath(filtered, opt.tz);
  const ranked = rankTop(grouped, opt.top);
  return ranked;
};

export const parseLines = (lines: string[]): Row[] => {
  const out: Row[] = [];
  for (const line of lines) {
    // 1行目はヘッダーのためスキップします
    const parts = line.split(',');
    if (parts.length !== 5) continue; // カラム数が5でない行（壊れた行）はスキップ
    // Trim all parts immediately after splitting to handle whitespace
    const timestamp = parts[0].trim();
    const userId = parts[1].trim();
    const path = parts[2].trim();
    const statusStr = parts[3].trim();
    const latencyMsStr = parts[4].trim();

    // Now validate the trimmed parts
    if (!timestamp || !userId || !path || !statusStr || !latencyMsStr) {
      continue;
    }
    // いずれかのカラムが空の場合はスキップ
    if (!timestamp || !userId || !path || !statusStr || !latencyMsStr) continue;

    const status = parseInt(statusStr, 10);
    const latencyMs = parseInt(latencyMsStr, 10);

    // status または latency が有効な数値でない場合はスキップ
    if (isNaN(status) || isNaN(latencyMs)) continue;

    // timestamp が有効な日付文字列でない場合はスキップ
    if (isNaN(new Date(timestamp).getTime())) continue;

    out.push({
      timestamp: timestamp.trim(),
      userId: userId.trim(),
      path: path.trim(),
      status: Number(status),
      latencyMs: Number(latencyMs),
    });
  }
  return out;
};
export const filterByDate = (rows: Row[], from: string, to: string): Row[] => {
  // 開始日をその日の00:00:00のタイムスタンプに変換する
  const fromTime = new Date(`${from}T00:00:00.000Z`).getTime();
  // 終了日をその日の23:59:59.999のタイムスタンプに変換して、その日全体を含める
  const toTime = new Date(`${to}T23:59:59.999Z`).getTime();
  return rows.filter((r) => {
    const t = new Date(r.timestamp).getTime();
    // タイムスタンプが範囲内にある行を保持する
    return t >= fromTime && t <= toTime;
  });
};

const toTZDate = (utcIso: string, tz: TZ): string => {
  const t = new Date(utcIso);
  const offsetHours = tz === 'jst' ? 9 : 7; // JST=UTC+9, ICT=UTC+7
  const local = new Date(t.getTime() + offsetHours * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = (local.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = local.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const groupByDatePath = (rows: Row[], tz: TZ) => {
  const map = new Map<string, { sum: number; cnt: number }>();
  for (const r of rows) {
    const date = toTZDate(r.timestamp, tz);
    const key = `${date}\u0000${r.path}`;
    const cur = map.get(key) || { sum: 0, cnt: 0 };
    cur.sum += r.latencyMs;
    cur.cnt += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries()).map(([k, v]) => {
    const [date, path] = k.split('\u0000');
    return { date, path, count: v.cnt, avgLatency: Math.round(v.sum / v.cnt) };
  });
};

const rankTop = (
  items: { date: string; path: string; count: number; avgLatency: number }[],
  top: number
) => {
  // 日付ごとに件数順で上位N
  const byDate = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byDate.get(it.date) || [];
    arr.push(it);
    byDate.set(it.date, arr);
  }
  const out: typeof items = [];
  for (const [, arr] of byDate) {
    arr.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
    out.push(...arr.slice(0, top));
  }
  // 安定した出力順: date ASC, count DESC
  out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      b.count - a.count ||
      a.path.localeCompare(b.path)
  );
  return out;
};
