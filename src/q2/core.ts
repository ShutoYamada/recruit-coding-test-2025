// ==============================
// Q2: アクセスログ集計（コアロジック）
// ------------------------------
// READMEの仕様に厳密に従い実装。入力CSVはUTC、期間フィルタはUTC起点（両端含む）。
// 集計結果は tz（jst/ict）適用後の日付で date×path 集約。avgLatency は四捨五入整数。
// 上位Nは「日付ごと」に count 降順（同数は path 昇順）。最終出力は
// date 昇順 → count 降順 → path 昇順の決定的順序。

import * as fs from 'node:fs';
import * as readline from 'node:readline';

export type Tz = 'jst' | 'ict';

export type Options = {
  filePath: string;              // CSV file path
  from?: string;                 // 'YYYY-MM-DD' in UTC (inclusive)
  to?: string;                   // 'YYYY-MM-DD' in UTC (inclusive)
  tz: Tz;                        // 'jst' (UTC+9) | 'ict' (UTC+7)
  top?: number;                  // top N per date (optional; if unset -> all)
};

export type OutputRow = {
  date: string;                  // YYYY-MM-DD after tz applied
  path: string;                  // e.g. /api/orders
  count: number;                 // occurrences per date×path
  avgLatency: number;            // rounded average latency (四捨五入)
};

// 期間フィルタの境界をUTCで作る（両端含む）
function makeUtcRange(from?: string, to?: string): { lo: number; hi: number } {
  const MIN = -8.64e15; // Date最小 ~ -275760-09-01
  const MAX =  8.64e15; // Date最大 ~ 275760-09-13

  const lo = from ? Date.parse(`${from}T00:00:00.000Z`) : MIN;
  const hi = to   ? Date.parse(`${to}T23:59:59.999Z`)   : MAX;

  return { lo, hi };
}

// tz適用後の「日付(YYYY-MM-DD)」を厳密に生成（UTCゲッターで手組み）
function toTzDateString(utcMs: number, tz: Tz): string {
  const offsetHours = tz === 'jst' ? 9 : 7;
  const shifted = new Date(utcMs + offsetHours * 60 * 60 * 1000);

  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1; // 0-based
  const d = shifted.getUTCDate();

  const mm = m < 10 ? `0${m}` : String(m);
  const dd = d < 10 ? `0${d}` : String(d);
  return `${y}-${mm}-${dd}`;
}

// CSV 1行をパース。壊れていれば null を返す（README: 壊れた行はスキップ）。
function parseCsvLine(line: string):
  | { tsMs: number; path: string; latency: number }
  | null {
  const parts = line.split(',');
  if (parts.length !== 5) return null;

  // _uid は未使用なので省略（lint対応）
  const [tsRaw, , pathRaw, statusRaw, latRaw] = parts;

  // timestamp (UTC)
  const ts = Date.parse(tsRaw);
  if (!Number.isFinite(ts)) return null;

  // status: 数値として妥当か簡易チェック（使わないが壊れ行除外のため）
  const status = Number(statusRaw);
  if (!Number.isFinite(status)) return null;

  // latency 必須
  const latency = Number(latRaw);
  if (!Number.isFinite(latency)) return null;

  // path: trim後に空ならNG
  const path = (pathRaw ?? '').trim();
  if (!path) return null;

  return { tsMs: ts, path, latency };
}

// ===== 追加: parseLines を公開 =====
/**
 * 複数行のCSV文字列を受け取り、壊れた行をスキップして配列を返すヘルパー。
 * ヘッダ処理はしない（与えられた行だけを対象にする）。
 */
export function parseLines(
  lines: string[]
): Array<{ tsMs: number; path: string; latency: number }> {
  const out: Array<{ tsMs: number; path: string; latency: number }> = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const rec = parseCsvLine(line); // 内部の行パーサ
    if (rec) out.push(rec);         // 壊れた行は無視
  }
  return out;
}

// 1行ずつ読みながら、期間フィルタ→TZ日付→date×path 集計。
export async function aggregate(opts: Options): Promise<OutputRow[]> {
  const { filePath, from, to, tz, top } = opts;
  const { lo, hi } = makeUtcRange(from, to);

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  // date|path → { count, sumLatency }
  const agg = new Map<string, { count: number; sumLatency: number }>();

  let isFirst = true;

  for await (const raw of rl) {
    const line = raw.trim();
    if (!line) continue;

    // ヘッダ行をスキップ（先頭1行だけ厳密に判定）
    if (isFirst) {
      isFirst = false;
      if (/^timestamp,userId,path,status,latencyMs$/i.test(line)) {
        continue;
      }
    }

    const rec = parseCsvLine(line);
    if (!rec) continue; // 壊れた行はスキップ

    // 期間フィルタ（UTC, 両端含む）
    if (rec.tsMs < lo || rec.tsMs > hi) continue;

    // tz適用後の日付
    const dateStr = toTzDateString(rec.tsMs, tz);

    const key = `${dateStr}|${rec.path}`;
    const cur = agg.get(key);
    if (cur) {
      cur.count += 1;
      cur.sumLatency += rec.latency;
    } else {
      agg.set(key, { count: 1, sumLatency: rec.latency });
    }
  }

  // Map → 配列化し、avgLatency を四捨五入で算出
  const rows: OutputRow[] = [];
  for (const [key, val] of agg.entries()) {
    const [date, path] = key.split('|');
    const avg = Math.round(val.sumLatency / val.count);
    rows.push({ date, path, count: val.count, avgLatency: avg });
  }

  // 日付ごとに TopN 抽出（count ↓, path ↑）
  const byDate = new Map<string, OutputRow[]>();
  for (const r of rows) {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }

  const topK = typeof top === 'number' && top > 0 ? top : Infinity;
  const sliced: OutputRow[] = [];

  // lint対応: 未使用変数を避けるため values() を用いる
  for (const list of byDate.values()) {
    list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;         // count DESC
      if (a.path !== b.path) return a.path.localeCompare(b.path); // path ASC
      return 0;
    });
    const take = list.slice(0, Math.min(list.length, topK));
    sliced.push(...take);
  }

  // 最終並び順 = date ↑ → count ↓ → path ↑（README）
  sliced.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);   // date ASC
    if (b.count !== a.count) return b.count - a.count;            // count DESC
    return a.path.localeCompare(b.path);                          // path ASC
  });

  return sliced;
}
