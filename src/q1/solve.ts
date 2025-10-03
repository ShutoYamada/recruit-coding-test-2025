/* eslint-disable @typescript-eslint/no-unused-vars */

export type Age = 'Adult' | 'Young' | 'Child';
export type Rating = 'G' | 'PG-12' | 'R18+';

export type Ticket = {
  age: Age;
  rating: Rating;
  startHH: number; // 0-23
  startMM: number; // 0-59
  durH: number; // >=0
  durM: number; // 0-59
  row: string; // 'A'-'L'
  col: number; // 1-24
};

const PRICE: Record<Age, number> = { Adult: 1800, Young: 1200, Child: 800 };

// 出力メッセージ（テストと同一文字列に揃える）
const MSG = {
  NEED_ADULT: '対象の映画の入場には大人の同伴が必要です',
  AGE_LIMIT: '対象の映画は年齢制限により閲覧できません',
  SEAT_LIMIT: '対象のチケットではその座席をご利用いただけません',
} as const;

/**
 * 仕様のポイント（READMEに準拠）:
 * - 各行ごとに OK なら価格、NG なら理由（カンマ区切り）。
 * - セット内に1枚でもNGがあれば「全体不可」→ 価格は出さず、NG行の理由だけを改行で出力。
 * - 理由の表示順は「同伴必要 → 年齢制限 → 座席制限」。
 *
 * ※ このファイルは “雛形” です。意図的に未実装/簡略化があります（TODO を参照）。
 *   - checkTimeRule / checkRating / checkSeat は要実装
 *   - 理由の並び替え（orderReasons）は要実装
 *   - parseLine のバリデーションは最小限（境界チェックなどを追加実装すること）
 *   - 「全体不可」時の価格抑制ロジックを実装すること
 */

/**
 * メイン処理関数  / Main Process Function
 * 入力された複数チケットを検証し、価格または理由を返す / Validate tickets and return price or reasons
 */
export const solve = (input: string): string => {
  const lines = input
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // smoke 用：空入力は空出力（テスト配線確認）/ In case of empty input, return empty output
  if (lines.length === 0) return '';

  // 入力をパース（不正なら即終了）/ Parse input, return error immediately if invalid
  const tickets: Ticket[] = [];
  for (const line of lines) {
    const t = parseLine(line);
    if (!t) return '不正な入力です';
    tickets.push(t);
  }

  // セット属性（同一上映前提）/ Set of attributes (assuming group tickets share the same screening)
  const hasAdult = tickets.some((t) => t.age === 'Adult');
  const hasChild = tickets.some((t) => t.age === 'Child'); // C5 で使用（グループ規則）
  const rating = tickets[0].rating;
  const endMinutes = calcEndMinutes(tickets[0]); // 今年は日跨ぎなし前提

  // 各行の評価 / Evaluate each line
  const evaluated: { ok: boolean; text: string }[] = [];
  let anyNg = false;

  for (const t of tickets) {
    const reasons: string[] = [];

    // 理由の push 順は README の順序に合わせておく（後で orderReasons で厳密化）/ Push reasons in the order specified in README (will refine with orderReasons later)
    if (!checkTimeRule(t, endMinutes, hasAdult, hasChild)) {
      reasons.push(MSG.NEED_ADULT);
    }
    if (!checkRating(t.age, rating, hasAdult)) {
      reasons.push(MSG.AGE_LIMIT);
    }
    if (!checkSeat(t)) {
      reasons.push(MSG.SEAT_LIMIT);
    }

    const ordered = orderReasons(reasons); // TODO: 並び替えを実装

    if (ordered.length === 0) {
      evaluated.push({ ok: true, text: `${PRICE[t.age]}円` });
    } else {
      anyNg = true;
      evaluated.push({ ok: false, text: uniqueStable(ordered).join(',') });
    }
  }

  // TODO 「全体不可」のときは価格を出さず、NG行の理由だけを出力する

  return evaluated.map((e) => e.text).join('\n');
};

/**
 * 簡易パーサ（最小限の検証のみ）
 * TODO:
 *  - startHH/startMM/durH/durM の範囲チェック（例: 23:59, 分は 0-59）
 *  - 座席の列番号 1-24 の範囲チェック
 *  - その他フォーマットの揺れ（必要なら）
 */
const parseLine = (line: string): Ticket | null => {
  const parts = line.split(',').map((s) => s.trim());
  if (parts.length !== 5) return null;

  const [ageRaw, ratingRaw, startRaw, durRaw, seatRaw] = parts;

  if (!['Adult', 'Young', 'Child'].includes(ageRaw)) return null;
  if (!['G', 'PG-12', 'R18+'].includes(ratingRaw)) return null;

  const start = startRaw.match(/^(\d{1,2}):(\d{2})$/);
  const dur = durRaw.match(/^(\d{1,2}):(\d{2})$/);
  const seat = seatRaw.match(/^([A-L])-(\d{1,2})$/i);
  if (!start || !dur || !seat) return null;

  const startHH = parseInt(start[1], 10);
  const startMM = parseInt(start[2], 10);
  const durH = parseInt(dur[1], 10);
  const durM = parseInt(dur[2], 10);
  const row = seat[1].toUpperCase();
  const col = parseInt(seat[2], 10);

  return {
    age: ageRaw as Age,
    rating: ratingRaw as Rating,
    startHH,
    startMM,
    durH,
    durM,
    row,
    col,
  };
};

const calcEndMinutes = (t: Ticket): number => {
  const start = t.startHH * 60 + t.startMM;
  const end = start + t.durH * 60 + t.durM;
  return end;
};

/**
 * 年齢/レーティングの規則
 *  - G: 誰でも可
 *  - PG-12: Child は Adult 同時購入がなければ不可
 *  - R18+: Adult 以外は不可
 */
const checkRating = (
  age: Age,
  rating: Rating,
  hasAdultInSet: boolean
): boolean => {
  // TODO ここを実装
  return true;
};

/**
 * 座席の規則
 *  - J〜L は Child 不可
 */
const checkSeat = (t: Ticket): boolean => {
  // TODO ここを実装
  return true;
};

/**
 * 時刻の規則（終了時刻ベース）
 *  - Adult がいれば常にOK
 *  - Adult が 0 かつ Child を含み、終了が 16:00 を超える → Young も含め全員 NG
 *  - Adult が 0 で Young 単独など、終了が 18:00 を超える Young は NG
 *  - ちょうど 16:00/18:00 は OK
 */
const checkTimeRule = (
  t: Ticket,
  endMinutes: number,
  hasAdultInSet: boolean,
  hasChildInSet: boolean
): boolean => {
  // TODO ここを実装
  return true;
};

/**
 * 理由の順序を安定化（README: 「同伴 → 年齢 → 座席」）
 */
const orderReasons = (reasons: string[]): string[] => {
  // TODO ここを実装
  return reasons;
};

// 重複排除（stable）
const uniqueStable = <T>(arr: T[]): T[] => {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
};
