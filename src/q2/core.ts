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
/**aggregate(): データ処理全体を集約する */
export type Output = Array<{
  date: string; // tz での YYYY-MM-DD
  path: string;
  count: number;
  avgLatency: number;
}>;

export const aggregate = (lines: string[], opt: Options): Output => {
  const rows = parseLines(lines);
  const grouped = groupByDatePath(rows, opt.tz);
  // Lấy top N cho từng ngày, nhưng chỉ lấy các ngày trong khoảng from/to
  const byDate = new Map<string, typeof grouped>();
  for (const it of grouped) {
    if (it.date >= opt.from && it.date <= opt.to) {
      const arr = byDate.get(it.date) || [];
      arr.push(it);
      byDate.set(it.date, arr);
    }
  }
  const out: typeof grouped = [];
  for (const [date, arr] of byDate) {
    arr.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
    out.push(...arr.slice(0, opt.top));
  }
  out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      b.count - a.count ||
      a.path.localeCompare(b.path)
  );
  return out;
};

/**parseLines(): CSV の各行を読み込み、壊れた行をスキップする */
export const parseLines = (lines: string[]): Row[] => {
  const out: Row[] = [];
  for (const line of lines) {
    if (!line.trim()) continue; //空行を安全にスキップする
    const [timestamp, userId, path, statusStr, latencyMsStr] = line.split(',');
    //列数を xác nhận
    if (!timestamp || !userId || !path || !statusStr || !latencyMsStr) continue;

    const status = Number(statusStr);
    const latencyMs = Number(latencyMsStr);

    // 数値でないステータスやレイテンシをスキップする
    if (Number.isNaN(status) || Number.isNaN(latencyMs)) continue;

    // 有効なISOタイムスタンプを確認する
    if (isNaN(Date.parse(timestamp))) continue;
    out.push({
      timestamp: timestamp.trim(),
      userId: userId.trim(),
      path: path.trim(),
      status,
      latencyMs,
    });
  }
  return out;
};

// filterByDate không còn cần thiết, đã filter theo local date trong aggregate

/**toTZDate(): UTC ISO をローカル日付（JST または ICT）に変換する */
const toTZDate = (utcIso: string, tz: TZ): string => {
  const t = new Date(utcIso);
  const offsetHours = tz === 'jst' ? 9 : 7; // JST=UTC+9, ICT=UTC+7
  const local = new Date(t.getTime() + offsetHours * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = (local.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = local.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};
 /**  groupByDatePath(): date と path ごとにグループ化する */
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
/**
 * 日付ごとに件数順で上位Nを抽出
 * 同数は path 昇順
 * 出力順は date ASC, count DESC, path ASC
 */
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
