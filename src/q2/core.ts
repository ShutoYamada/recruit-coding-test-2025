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

  // 最終的なソート順：date ASC, count DESC, path ASC
  ranked.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    if (a.count > b.count) return -1;
    if (a.count < b.count) return 1;
    if (a.path < b.path) return -1;
    if (a.path > b.path) return 1;
    return 0;
  });

  return ranked;
};

export const parseLines = (lines: string[]): Row[] => {
  const out: Row[] = [];
  // ヘッダー行があればスキップ
  const dataLines = lines[0]?.startsWith('timestamp,') ? lines.slice(1) : lines;

  for (const line of dataLines) {
    const [timestamp, userId, path, statusStr, latencyMsStr] = line.split(',');
    if (!timestamp || !userId || !path || !statusStr || !latencyMsStr) continue; // カラムが不足している行はスキップ

    const status = Number(statusStr);
    const latencyMs = Number(latencyMsStr);

    // statusまたはlatencyが数値でない場合はスキップ
    if (isNaN(status) || isNaN(latencyMs)) continue;

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

const filterByDate = (rows: Row[], from: string, to: string): Row[] => {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  // 'to'の日付全体を含むように、toDateの時刻を日の終わりに設定
  toDate.setUTCHours(23, 59, 59, 999);

  return rows.filter((r) => {
    const rDate = new Date(r.timestamp);
    return rDate >= fromDate && rDate <= toDate;
  });
};

const toTZDate = (t: string, tz: TZ): string => {
  const dateObj = new Date(t);
  const offsetHours = tz === 'jst' ? 9 : 7; // JST=UTC+9, ICT=UTC+7
  // オフセットを適用
  dateObj.setUTCHours(dateObj.getUTCHours() + offsetHours);

  const y = dateObj.getUTCFullYear();
  const m = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = dateObj.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const groupByDatePath = (rows: Row[], tz: TZ) => {
  const map = new Map<string, { sum: number; cnt: number }>();
  for (const r of rows) {
    const date = toTZDate(r.timestamp, tz);
    const key = `${date}\u0000${r.path}`; // 安全な区切り文字としてnull文字を使用
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
  // アイテムを日付ごとにグループ化
  const byDate = new Map<string, typeof items>();
  for (const item of items) {
    const dateItems = byDate.get(item.date) || [];
    dateItems.push(item);
    byDate.set(item.date, dateItems);
  }

  const ranked: typeof items = [];
  // 各日付に対してトップNを処理
  for (const dateItems of byDate.values()) {
    dateItems.sort((a, b) => {
      // countの降順、次にpathの昇順でソート
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.path.localeCompare(b.path);
    });
    // トップNを取得して最終結果に追加
    ranked.push(...dateItems.slice(0, top));
  }
  return ranked;
};

