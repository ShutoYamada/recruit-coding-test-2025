type TZ = 'jst' | 'ict';

export type Row = {
  timestamp: string; // ISO8601 UTC
  userId: string;
  path: string;
  status: number;
  latencyMs: number;
};

export type Options = {
  from: string; // YYYY-MM-DD (UTC基点)
  to: string; // YYYY-MM-DD (UTC基点)
  tz: TZ;
  top: number;
};

export type Output = Array<{
  date: string; // tz変換後 YYYY-MM-DD
  path: string;
  count: number;
  avgLatency: number;
}>;

export const aggregate = (lines: string[], opt: Options): Output => {
  // bỏ header nếu có
  const contentLines = lines[0].startsWith('timestamp')
    ? lines.slice(1)
    : lines;
  const rows = parseLines(contentLines);
  const filtered = filterByDate(rows, opt.from, opt.to);
  const grouped = groupByDatePath(filtered, opt.tz);
  return rankTop(grouped, opt.top);
};

export const parseLines = (lines: string[]): Row[] => {
  const out: Row[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',').map((x) => x.trim());
    if (parts.length !== 5) continue;

    const [timestamp, userId, path, statusStr, latencyStr] = parts;
    if (!timestamp || !userId || !path || !statusStr || !latencyStr) continue;

    const status = Number(statusStr);
    const latencyMs = Number(latencyStr);

    if (isNaN(status) || isNaN(latencyMs)) continue;
    if (isNaN(new Date(timestamp).getTime())) continue;

    out.push({ timestamp, userId, path, status, latencyMs });
  }
  return out;
};

export const filterByDate = (rows: Row[], from: string, to: string): Row[] => {
  const fromT = Date.parse(from + 'T00:00:00Z');
  const toT = Date.parse(to + 'T23:59:59.999Z');
  return rows.filter((r) => {
    const t = Date.parse(r.timestamp);
    return t >= fromT && t <= toT;
  });
};

export const toTZDate = (utcIso: string, tz: TZ): string => {
  const offsetH = tz === 'jst' ? 9 : 7;
  const d = new Date(utcIso);
  const shifted = new Date(d.getTime() + offsetH * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
};

export const groupByDatePath = (rows: Row[], tz: TZ) => {
  const map = new Map<string, { sum: number; cnt: number }>();
  for (const r of rows) {
    const date = toTZDate(r.timestamp, tz);
    const key = `${date}\u0000${r.path}`;
    const cur = map.get(key) ?? { sum: 0, cnt: 0 };
    cur.sum += r.latencyMs;
    cur.cnt += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries()).map(([k, v]) => {
    const [date, path] = k.split('\u0000');
    return { date, path, count: v.cnt, avgLatency: Math.round(v.sum / v.cnt) };
  });
};

export const rankTop = (
  items: { date: string; path: string; count: number; avgLatency: number }[],
  top: number
) => {
  const byDate = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byDate.get(it.date) ?? [];
    arr.push(it);
    byDate.set(it.date, arr);
  }

  const out: typeof items = [];
  for (const arr of byDate.values()) {
    arr.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
    out.push(...arr.slice(0, top));
  }

  out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      b.count - a.count ||
      a.path.localeCompare(b.path)
  );
  return out;
};
