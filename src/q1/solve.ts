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

type MsgType = typeof MSG[keyof typeof MSG];

/**
 * 仕様のポイント（READMEに準拠）:
 * - 各行ごとに OK なら価格、NG なら理由（カンマ区切り）。
 * - セット内に1枚でもNGがあれば「全体不可」→ 価格は出さず、NG行の理由だけを改行で出力。
 * - 理由の表示順は「同伴必要 → 年齢制限 → 座席制限」。
 */
export const solve = (input: string): string => {
  const lines = input
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';

  // 入力をパース（不正なら即終了）
  const tickets: Ticket[] = [];
  for (const line of lines) {
    const t = parseLine(line);
    if (!t) return '不正な入力です';
    tickets.push(t);
  }

  // セット属性（同一上映前提）
  const hasAdult = tickets.some((t) => t.age === 'Adult');
  const hasChild = tickets.some((t) => t.age === 'Child');
  const rating = tickets[0].rating;
  const endMinutes = calcEndMinutes(tickets[0]); // 日跨ぎなし前提

  // 各行の評価
  const evaluated: { ok: boolean; text: string }[] = [];
  let anyNg = false;

  for (const t of tickets) {
    const reasons: MsgType[] = [];

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

    const ordered = orderReasons(reasons);

    if (ordered.length === 0) {
      evaluated.push({ ok: true, text: `${PRICE[t.age]}円` });
    } else {
      anyNg = true;
      evaluated.push({ ok: false, text: uniqueStable(ordered).join(',') });
    }
  }

  // 「全体不可」のときは価格を出さず、NG行の理由だけを出力する
  if (anyNg) {
    return evaluated
      .filter((e) => !e.ok)
      .map((e) => e.text)
      .join('\n');
  }

  return evaluated.map((e) => e.text).join('\n');
};

/**
 * バリデーションチェック付きのパーサ
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

  // 値の範囲チェック
  if (startHH < 0 || startHH > 23 || startMM < 0 || startMM > 59) return null;
  if (durH < 0 || durM < 0 || durM > 59) return null;
  if (col < 1 || col > 24) return null;

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
 * - G: 誰でも可
 * - PG-12: Child は Adult 同時購入がなければ不可
 * - R18+: Adult 以外は不可
 */
const checkRating = (
  age: Age,
  rating: Rating,
  hasAdultInSet: boolean
): boolean => {
  switch (rating) {
    case 'G':
      return true;
    case 'PG-12':
      // Child で、セット内に Adult がいなければ不可
      if (age === 'Child' && !hasAdultInSet) {
        return false;
      }
      return true;
    case 'R18+':
      // Adult のみ可
      return age === 'Adult';
  }
  return true;
};

/**
 * 座席の規則
 * - J〜L は Child 不可
 */
const checkSeat = (t: Ticket): boolean => {
  if (t.age === 'Child') {
    if (['J', 'K', 'L'].includes(t.row)) {
      return false;
    }
  }
  return true;
};

/**
 * 時刻の規則（終了時刻ベース）
 * - Adult がいれば常にOK
 * - Adult が 0 かつ Child を含み、終了が 16:00 を超える → Young も含め全員 NG
 * - Adult が 0 で Young 単独など、終了が 18:00 を超える Young は NG
 * - ちょうど 16:00/18:00 は OK
 */
const checkTimeRule = (
  t: Ticket,
  endMinutes: number,
  hasAdultInSet: boolean,
  hasChildInSet: boolean
): boolean => {
  // セット内に Adult がいれば、時刻規則は常に OK
  if (hasAdultInSet) {
    return true;
  }

  // グループ規則：セット内に Child がいて終演が遅い場合、全員が不可
  if (hasChildInSet && endMinutes > 16 * 60) {
    return false;
  }

  // 個人規則（Adult がいない場合のみ適用）
  if (t.age === 'Young' && endMinutes > 18 * 60) {
    return false;
  }
  
  // この条件は上記のグループ規則に含まれるが、明確化のため記述
  if (t.age === 'Child' && endMinutes > 16 * 60) {
    return false;
  }

  return true;
};

/**
 * 理由の順序を安定化（README: 「同伴 → 年齢 → 座席」）
 */
const orderReasons = (reasons: MsgType[]): MsgType[] => {
  const order: MsgType[] = [MSG.NEED_ADULT, MSG.AGE_LIMIT, MSG.SEAT_LIMIT];
  return reasons.sort((a, b) => order.indexOf(a) - order.indexOf(b));
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