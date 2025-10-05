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

/** 行が不正かどうかを確認する関数 / Check if a line is invalid */
const isInvalidLine = (
  timestamp?: string,
  userId?: string,
  path?: string,
  statusStr?: string,
  latencyStr?: string
): boolean => {
  // 欠損値チェック / Missing field check
  if (!timestamp || !userId || !path || !statusStr || !latencyStr) return true;

  // 数値変換と検証 / Convert to number and validate
  const status = Number(statusStr);
  const latency = Number(latencyStr);
  if (Number.isNaN(status) || Number.isNaN(latency)) return true;

  return false;
};

/** CSVデータをパースしてRow配列を返す関数 / Parse CSV lines into Row array */
export const parseLines = (lines: string[]): Row[] => {
  const out: Row[] = []; // 結果格納用配列 / Output result array

  for (const line of lines) {
    // カンマで分割 / Split by comma
    const parts = line.split(',').map((s) => s.trim());

    // フィールド数チェック / Field count check
    if (parts.length !== 5) continue;

    const [timestamp, userId, path, statusStr, latencyStr] = parts;

    // ヘッダー行をスキップ / Skip header line
    if (timestamp.toLowerCase() === 'timestamp') continue;

    // 行の妥当性を検証 (軽量チェック) / Validate line (light check)
    if (isInvalidLine(timestamp, userId, path, statusStr, latencyStr)) continue;

    // 正常な行を追加 / Add valid line to output
    out.push({
      timestamp,
      userId,
      path,
      status: Number(statusStr),
      latencyMs: Number(latencyStr),
    });
  }

  return out;
};


const filterByDate = (rows: Row[], from: string, to: string): Row[] => {
  const fromT = Date.parse(`${from}T00:00:00.000Z`);
  const toT = Date.parse(`${to}T23:59:59.999Z`); // from 00:00 UTC, to 23:59 UTC
  // UTCの00:00から23:59までの範囲を指定

  return rows.filter((r) => {
    const t = Date.parse(r.timestamp);
    return Number.isFinite(t) && t >= fromT && t <= toT; 
    // keep if (t) valid and within range [fromT, toT]
    // tが有効で[fromT, toT]の範囲内にある場合に保持する
  });
};

// converts an ISO UTC time string (utcIso) to a date (YYYY-MM-DD) in the specified time zone (tz)
// ISO形式のUTC時刻文字列(utcIso)を指定されたタイムゾーン(tz)の日付(YYYY-MM-DD)に変換する
const toTZDate = (utcIso: string, tz: TZ): string => {
  
  const t = new Date(utcIso); 
  // (t) has form : "2025-01-04T15:00:00Z" (UTC)
  // UTC形式の時刻 "2025-01-04T15:00:00Z" のような形式を持つ

  const offsetHours = tz === 'jst' ? 9 : 7; 
  // JST=UTC+9, ICT=UTC+7
  // JSTはUTC+9、ICTはUTC+7

  const local = new Date(t.getTime() + offsetHours * 60 * 60 * 1000); 
  // simulates the corresponding local time
  // 対応するローカル時刻を再現する

  const y = local.getUTCFullYear();
  const m = (local.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = local.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// (group by) records in (date, path) pairs
// calculate the number of accesses (count) & average latency (avgLatency) for each group.
// (日付, パス)ごとにレコードをグループ化し、各グループのアクセス数(count)と平均レイテンシ(avgLatency)を計算する
const groupByDatePath = (rows: Row[], tz: TZ) => {
  const map = new Map<string, { sum: number; cnt: number }>(); 
  // save total delay and number of records
  // 合計レイテンシとレコード数を保存する

  for (const r of rows) {
    const date = toTZDate(r.timestamp, tz); 
    // (utcIso) to (YYYY-MM-DD) with (tz)
    // UTC時刻をタイムゾーン付きの日付(YYYY-MM-DD)に変換
    
    const key = `${date}\u0000${r.path}`; 
    // concatenate date and path into a single key with "\u0000"
    // 日付とパスを「\u0000」で連結して1つのキーにする

    const cur = map.get(key) || { sum: 0, cnt: 0 }; 
    // cumulative latencyMs & count requests.
    // レイテンシ合計(sum)とリクエスト件数(cnt)を累積する
    
    cur.sum += r.latencyMs;
    cur.cnt += 1;
    map.set(key, cur);
  }

  // map → (Output[]); key -> date, path; calculate avgLatency
  // Map -> (Output[])に変換し、キーを(date, path)に分解してavgLatencyを計算する
  return Array.from(map.entries()).map(([k, v]) => {
    const [date, path] = k.split('\u0000');
    return { date, path, count: v.cnt, avgLatency: Math.round(v.sum / v.cnt) };
  });
};

const rankTop = (
  items: { date: string; path: string; count: number; avgLatency: number }[],
  top: number
) => {
  if (top <= 0) throw new Error("Invalid k value!");

  // create a Map to group all items with the same date
  // 同じ日付のアイテムをグループ化するためのMapを作成
  const byDate = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byDate.get(it.date) || [];
    arr.push(it);
    byDate.set(it.date, arr);
  }

  // 各日付グループ内でcountの降順にソートし、同値の場合はpathの昇順でソートする。
  // 上位(top)件を取得して結果配列に追加する
  const out: typeof items = [];
  for (const [, arr] of byDate) {
    // dùng stable sort (ECMAScript 2019+ đảm bảo ổn định)
    arr.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.path.localeCompare(b.path);
    });
    out.push(...arr.slice(0, top));
  }

  // 全体を決定的順序でソート (date ↑ -> count ↓ -> path ↑)
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (b.count !== a.count) return b.count - a.count;
    return a.path.localeCompare(b.path);
  });

  return out;
};
