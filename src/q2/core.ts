type TZ = 'jst' | 'ict';

export type Row = {
  timestamp: string;                                                // ISO8601 UTC
  userId: string;
  path: string;
  status: number;
  latencyMs: number;
};



export type Options = {
  from: string;                                                     // YYYY-MM-DD (UTC 起点)
  to: string;                                                       // YYYY-MM-DD (UTC 起点)
  tz: TZ;
  top: number;
};

export type Output = Array<{
  date: string;                                                     // tz での YYYY-MM-DD
  path: string;
  count: number;
  avgLatency: number;
}>;

export const aggregate = (lines: string[], opt: Options): Output => { // main function
  const rows = parseLines(lines);
  const filtered = filterByDate(rows, opt.from, opt.to);
  const grouped = groupByDatePath(filtered, opt.tz);
  const ranked = rankTop(grouped, opt.top);
  return ranked;
};

export const parseLines = (lines: string[]): Row[] => {               // from CSV lines to Row[]
  const out: Row[] = [];
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length !== 5) continue;

    const [timestamp, userId, path, statusStr, latencyStr] = parts;    // destructure
    const status = Number(statusStr);
    const latencyMs = Number(latencyStr);

    if (!timestamp || !userId || !path || isNaN(status) || isNaN(latencyMs)) continue;  // basic validation

    out.push({                                                        // trim spaces
      timestamp: timestamp.trim(),
      userId: userId.trim(),
      path: path.trim(),
      status,
      latencyMs,
    });
  }
  return out;
};


const filterByDate = (rows: Row[], from: string, to: string): Row[] => { // filter by from/to
  const fromT = Date.parse(from + 'T00:00:00Z');
  const toT = Date.parse(to + 'T23:59:59Z');
  return rows.filter((r) => {                                         // include from/to boundary
    const t = Date.parse(r.timestamp);
    return t >= fromT && t <= toT;
  });
};

const toTZDate = (utcIso: string, tz: TZ): string => {                // convert UTC ISO to YYYY-MM-DD in tz
  const t = new Date(utcIso);
  const offsetHours = tz === 'jst' ? 9 : 7; // JST=UTC+9, ICT=UTC+7
  const local = new Date(t.getTime() + offsetHours * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = (local.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = local.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const groupByDatePath = (rows: Row[], tz: TZ) => {                    // group by (date, path) and aggregate
  const map = new Map<string, { sum: number; cnt: number }>();
  for (const r of rows) {
    const date = toTZDate(r.timestamp, tz);
    const key = `${date}\u0000${r.path}`;
    const cur = map.get(key) || { sum: 0, cnt: 0 };
    cur.sum += r.latencyMs;
    cur.cnt += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries()).map(([k, v]) => {                   // to Output item
    const [date, path] = k.split('\u0000');
    return { date, path, count: v.cnt, avgLatency: Math.round(v.sum / v.cnt) };
  });
};

const rankTop = (                                                      // rank top N items
  items: { date: string; path: string; count: number; avgLatency: number }[],
  top: number
) => {
  // 日付ごとに件数順で上位N                                            (yes it is :thumbsup:)
  const byDate = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byDate.get(it.date) || [];
    arr.push(it);
    byDate.set(it.date, arr);
  }
  const out: typeof items = [];                                       // final output
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


