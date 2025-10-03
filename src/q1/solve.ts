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
export const solve = (input: string): string => {
  const lines = input
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // smoke 用：空入力は空出力（テスト配線確認）
  if (lines.length === 0) return '';

  // 入力をパース（不正なら即終了）
  const tickets: Ticket[] = [];
  for (const line of lines) {
    const t = parseLine(line);
    if (!t) return '不正な入力です'; // TODO: 必要に応じて詳細化してもよい（仕様は1行固定でOK）
    tickets.push(t);
  }

  // セット属性（同一上映前提）
  const hasAdult = tickets.some((t) => t.age === 'Adult');
  const hasChild = tickets.some((t) => t.age === 'Child'); // C5 で使用（グループ規則）
  const rating = tickets[0].rating;
  const endMinutes = calcEndMinutes(tickets[0]); // 今年は日跨ぎなし前提

  // 各行の評価
  const evaluated: { ok: boolean; text: string }[] = [];
  let anyNg = false;

  for (const t of tickets) {
    const reasons: string[] = [];

    // 理由の push 順は README の順序に合わせておく（後で orderReasons で厳密化）
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
/**
 *
 * @param line - 入力行 / Input line
 * @returns パース結果 or null (不正入力) / Parsed result or null (invalid input)
 * バリデーション / Validation:
 * start: HH:MM (0<=HH<=23, 0<=MM<=59)
 * dur: H:MM (H>=0, 0<=MM<=59)
 * seat: [A-L]-[1-24]
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

  // バリデーション / Validation
  if (startHH < 0 || startHH > 23) return null
  if (startMM < 0 || startMM > 59) return null
  if (durH < 0) return null
  if (durM < 0 || durM > 59) return null
  if (col < 1 || col > 24) return null

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

/**
 *
 * @param age - 年齢区分 (Adult | Young | Child) / Age category
 * @param rating - レーティング (G | PG-12 | R18+) / Movie rating
 * @param hasAdultInSet - 購入セットに Adult が含まれるか / Whether the ticket set includes an Adult
 * @returns true=購入可 / purchasable, false=購入不可 / not purchasable
 */
const checkRating = (
  age: Age,
  rating: Rating,
  hasAdultInSet: boolean
): boolean => {
  // G は全員OK / G rating: always allowed
  if (rating === 'G')
    return true

  // PG-12: Child は Adult がいないと NG / Child requires Adult in set
  if (rating === 'PG-12') {
    if (age === 'Child' && !hasAdultInSet) return false
    return true;
  }

  // R18+: Adult のみ可 / Only Adult is allowed
  if (rating === 'R18+') {
    if (age !== 'Adult') return false
    return true;
  }

  // 想定外は NG / Unexpected case -> NG
  return false;
};

/**
 * 座席の規則
 *  - J〜L は Child 不可
 */

/**
 *
 * @param t - チケット情報 / Ticket info
 * @returns true=利用可 / allowed, false=利用不可 / not allowed
 */
const checkSeat = (t: Ticket): boolean => {
  if (t.age === 'Child' && ['J', 'K', 'L'].includes(t.row)) {
    return false;
  }
  return true;
};

/**
 * 時刻の規則（終了時刻ベース）
 *  - Adult がいれば常にOK
 *  - Adult が 0 かつ Child を含み、終了が 16:00 を超える → Young も含め全員 NG
 *  - Adult が 0 で Young 単独など、終了が 18:00 を超える Young は NG
 *  - ちょうど 16:00/18:00 は OK
 */
/**
 *
 * @param t - チケット情報 / Ticket info
 * @param endMinutes - 終了時刻（分） / End time (in minutes)
 * @param hasAdultInSet - 購入セットに Adult が含まれるか / Whether the ticket set includes an Adult
 * @param hasChildInSet - 購入セットに Child が含まれるか / Whether the ticket set includes a Child
 * @returns true=利用可 / allowed, false=利用不可 / not allowed
 */
const checkTimeRule = (
  t: Ticket,
  endMinutes: number,
  hasAdultInSet: boolean,
  hasChildInSet: boolean
): boolean => {
  // Adult がいれば常にOK / Always allowed if there's an Adult
  if (hasAdultInSet) return true

  // Adult が 0 かつ Child を含み、終了が 16:00 を超える -> Young も含め全員 NG
  if (hasChildInSet && endMinutes > 16 * 60) {
    return false
  }

  // Adult が 0 で Young 単独など、終了が 18:00 を超える Young は NG
  if (t.age === 'Young' && endMinutes > 18 * 60) {
    return false
  }

  // それ以外は OK / Otherwise, it's allowed
  return true;
};

/**
 * 理由の順序を安定化（README: 「同伴 → 年齢 → 座席」）
 */

/**
 *
 * @param reasons - 理由リスト / List of reasons
 * @returns 順序が安定化された配列 / Reordered array of reasons
 */
const orderReasons = (reasons: string[]): string[] => {
  const priority: Record<string, number> = {
    [MSG.NEED_ADULT]: 1,
    [MSG.AGE_LIMIT]: 2,
    [MSG.SEAT_LIMIT]: 3,
  }
  return reasons.slice().sort((a, b) => {
    return (priority[a] ?? 99) - (priority[b] ?? 99);
  })
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
