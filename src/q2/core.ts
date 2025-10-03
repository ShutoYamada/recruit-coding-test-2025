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
  const rows = parseLines(lines);
  const filtered = filterByDate(rows, opt.from, opt.to);
  const grouped = groupByDatePath(filtered, opt.tz);
  const ranked = rankTop(grouped, opt.top);
  return ranked;
};

export const parseLines = (lines: string[]): Row[] => {
  const out: Row[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Bỏ qua header
    if (
      /^timestamp\s*,\s*userId\s*,\s*path\s*,\s*status\s*,\s*latencyMs$/i.test(
        line
      )
    ) {
      continue;
    }

    const parts = line.split(',');
    if (parts.length !== 5) continue; // bỏ qua nếu thiếu cột

    const [timestamp0, userId0, path0, status0, latency0] = parts.map((s) =>
      s.trim()
    );

    const t = Date.parse(timestamp0);
    const status = Number(status0);
    const latencyMs = Number(latency0);

    if (!Number.isFinite(t)) continue; // timestamp hỏng
    if (!Number.isFinite(status)) continue; // status không phải số
    if (!Number.isFinite(latencyMs)) continue; // latency không phải số

    out.push({
      timestamp: new Date(t).toISOString(),
      userId: userId0,
      path: path0,
      status,
      latencyMs,
    });
  }
  return out;
};

const filterByDate = (rows: Row[], from: string, to: string): Row[] => {
  const fromT = Date.parse(from + 'T00:00:00Z');
  const toT = Date.parse(to + 'T23:59:59Z');
  return rows.filter((r) => {
    const t = Date.parse(r.timestamp);
    return t >= fromT && t <= toT;
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
