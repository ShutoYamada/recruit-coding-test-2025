// タイムゾーン定義: JST=UTC+9, ICT=UTC+7
type TZ = 'jst' | 'ict';

// CSVの1行を表す型
export type Row = {
  timestamp: string; // ISO8601 UTC形式のタイムスタンプ
  userId: string;   // ユーザーID
  path: string;     // アクセスパス
  status: number;   // HTTPステータスコード
  latencyMs: number; // レスポンス時間（ミリ秒）
};

// 集計オプション
export type Options = {
  from: string; // 開始日 YYYY-MM-DD (UTC基準)
  to: string;   // 終了日 YYYY-MM-DD (UTC基準)
  tz: TZ;       // 出力時のタイムゾーン
  top: number;  // 各日付の上位N件
};

// 集計結果の出力型
export type Output = Array<{
  date: string;       // 指定タイムゾーンでの日付 YYYY-MM-DD
  path: string;       // アクセスパス
  count: number;      // アクセス件数
  avgLatency: number; // 平均レスポンス時間（四捨五入）
}>;

// メイン集計処理：CSVラインから最終出力まで
export const aggregate = (lines: string[], opt: Options): Output => {
  const rows = parseLines(lines);                    // CSVパース
  const filtered = filterByDate(rows, opt.from, opt.to); // 期間フィルタ
  const grouped = groupByDatePath(filtered, opt.tz);     // 日付×パス別集計
  const ranked = rankTop(grouped, opt.top);              // 上位N抽出とソート
  return ranked;
};

// CSVラインをパースしてRow配列に変換（壊れた行はスキップ）
export const parseLines = (lines: string[]): Row[] => {
  const out: Row[] = [];
  for (const line of lines) {
    // 空行・空白のみの行をスキップ
    if (!line || /^\s*$/.test(line)) continue;
    
    const [timestamp, userId, path, status, latencyMs] = line.split(',');
    // カラム不足の行をスキップ
    if (!timestamp || !userId || !path || !status || !latencyMs) continue;
    
    // 数値フィールドの検証
    const statusNum = Number(status);
    const latencyNum = Number(latencyMs);
    if (isNaN(statusNum) || isNaN(latencyNum)) continue; // 無効な数値はスキップ
    
    out.push({
      timestamp: timestamp.trim(),
      userId: userId.trim(),
      path: path.trim(),
      status: statusNum,
      latencyMs: latencyNum,
    });
  }
  return out;
};

// 期間フィルタ：指定された日付範囲内のレコードのみ抽出（両端含む）
const filterByDate = (rows: Row[], from: string, to: string): Row[] => {
  const fromT = Date.parse(from + 'T00:00:00Z'); // 開始日の00:00:00UTC
  const toT = Date.parse(to + 'T23:59:59Z');     // 終了日の23:59:59UTC
  return rows.filter((r) => {
    const t = Date.parse(r.timestamp);
    return t >= fromT && t <= toT; // 両端含む
  });
};

// UTC時刻を指定タイムゾーンの日付文字列に変換
const toTZDate = (utcIso: string, tz: TZ): string => {
  const t = new Date(utcIso);
  const offsetHours = tz === 'jst' ? 9 : 7; // JST=UTC+9, ICT=UTC+7
  // タイムゾーンオフセットを適用
  const local = new Date(t.getTime() + offsetHours * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = (local.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = local.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// 日付×パス別にグループ化して件数と平均レスポンス時間を計算
const groupByDatePath = (rows: Row[], tz: TZ) => {
  const map = new Map<string, { sum: number; cnt: number }>();
  for (const r of rows) {
    const date = toTZDate(r.timestamp, tz);
    const key = `${date}\u0000${r.path}`; // NULL文字で区切ってユニークキーにする
    const cur = map.get(key) || { sum: 0, cnt: 0 };
    cur.sum += r.latencyMs; // レスポンス時間の合計
    cur.cnt += 1;           // アクセス件数
    map.set(key, cur);
  }
  return Array.from(map.entries()).map(([k, v]) => {
    const [date, path] = k.split('\u0000');
    return { date, path, count: v.cnt, avgLatency: Math.round(v.sum / v.cnt) }; // 平均を四捨五入
  });
};

// 日付ごとに上位N件を抽出し、最終的な並び順でソート
const rankTop = (
  items: { date: string; path: string; count: number; avgLatency: number }[],
  top: number
) => {
  // 日付ごとにグループ化
  const byDate = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byDate.get(it.date) || [];
    arr.push(it);
    byDate.set(it.date, arr);
  }
  const out: typeof items = [];
  // 各日付で件数降順、同数時はパス昇順でソートして上位N件を抽出
  for (const [, arr] of byDate) {
    arr.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
    out.push(...arr.slice(0, top));
  }
  // 最終出力順：日付昇順 → 件数降順 → パス昇順
  out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      b.count - a.count ||
      a.path.localeCompare(b.path)
  );
  return out;
};
