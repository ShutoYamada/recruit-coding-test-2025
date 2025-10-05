import { time } from "node:console";

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
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length !== 5) continue;

    const [timestamp, userId, path, status, latencyMs] = parts.map((p) => p.trim());
    if (!timestamp || !userId || !path || !status || !latencyMs) continue; // 壊れ行はスキップ

    if(!isValidTimestamp(timestamp)) continue;
    if(!isValidUserId(userId)) continue;
    if(!isValidPath(path)) continue;
    if(!isValidStatus(status)) continue;
    if(!isValidLatency(latencyMs)) continue;

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

const isValidTimestamp = (ts: string): boolean => {
  if (ts.length !== 20) return false;
  if (
    ts[4] !== '-' || ts[7] !== '-' ||
    ts[10] !== 'T' ||
    ts[13] !== ':' || ts[16] !== ':' ||
    ts[19] !== 'Z'
  ) return false;

  const year   = Number(ts.slice(0, 4));
  const month  = Number(ts.slice(5, 7));
  const day    = Number(ts.slice(8, 10));
  const hour   = Number(ts.slice(11, 13));
  const minute = Number(ts.slice(14, 16));
  const second = Number(ts.slice(17, 19));
  
  const dt = new Date(ts);
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day &&
    dt.getUTCHours() === hour &&
    dt.getUTCMinutes() === minute &&
    dt.getUTCSeconds() === second
  );
}

const isValidPath = (p: string): boolean => {
  const PATH_RE = /^(?!.*\/\/)(?!.*\s)\/(?:[A-Za-z0-9._-]|%(?:[0-9A-Fa-f]{2})|\/)*$/;
  if (typeof p !== "string" || p.length === 0) return false;
  return PATH_RE.test(p);
}

const isValidStatus = (s: string): boolean => {
  if (typeof s !== "string" || s.length === 0) return false;

  // すべての文字が数字かどうかをチェックする
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 48 || code > 57) return false; // 0–9
  }

  const num = Number(s);
  if (!Number.isInteger(num)) return false;
  return num >= 100 && num <= 599;
}

const isValidUserId = (s: string): boolean => {
  const result = s.match(/^[A-Za-z0-9._@-]+$/);
  if(result) return true;
  return false;
}

const isValidLatency = (s: string): boolean => {
  if (s.length === 0) return false;

  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 48 || code > 57) return false; // 0–9
  }

  const num = Number(s);
  return Number.isInteger(num) && num >= 0;
}

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
