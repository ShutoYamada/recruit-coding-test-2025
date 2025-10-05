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
    if (!t) return '不正な入力です';
    tickets.push(t);
  }

  // セット属性（同一上映前提）
  const hasAdult = tickets.some((t) => t.age === 'Adult');
  const hasChild = tickets.some((t) => t.age === 'Child');
  const rating = tickets[0].rating;
  const endMinutes = calcEndMinutes(tickets[0]); // 日跨ぎは考慮しない（仕様）

  // 各行の評価
  const evaluated: { ok: boolean; text: string }[] = [];
  let anyNg = false;

  for (const t of tickets) {
    const reasons: string[] = [];

    // push 順は README の表示優先順に合わせても良い（orderReasons で厳密化）
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
    const uniq = uniqueStable(ordered);

    if (uniq.length === 0) {
      evaluated.push({ ok: true, text: `${PRICE[t.age]}円` });
    } else {
      anyNg = true;
      evaluated.push({ ok: false, text: uniq.join(',') });
    }
  }

  // 全体不可: セット内に1枚でもNGがあれば、価格は出さずNG行の理由のみ改行で出力
  if (anyNg) {
    return evaluated
      .filter((e) => !e.ok)
      .map((e) => e.text)
      .join('\n');
  }

  return evaluated.map((e) => e.text).join('\n');
};

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

  if (
    !(startHH >= 0 && startHH <= 23) ||
    !(startMM >= 0 && startMM <= 59) ||
    !(durH >= 0) ||
    !(durM >= 0 && durM <= 59) ||
    !(col >= 1 && col <= 24)
  ) {
    return null;
  }

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

const checkRating = (
  age: Age,
  rating: Rating,
  hasAdultInSet: boolean
): boolean => {
  if (rating === 'G') return true;
  if (rating === 'R18+') return age === 'Adult';
  // PG-12
  if (rating === 'PG-12') {
    if (age === 'Child' && !hasAdultInSet) return false;
    return true;
  }
  return true;
};

/**
 * 座席の規則
 *  - J〜L は Child 不可
 */
const checkSeat = (t: Ticket): boolean => {
  const bannedRowsForChild = ['J', 'K', 'L'];
  if (t.age === 'Child' && bannedRowsForChild.includes(t.row)) {
    return false;
  }
  return true;
};

const checkTimeRule = (
  t: Ticket,
  endMinutes: number,
  hasAdultInSet: boolean,
  hasChildInSet: boolean
): boolean => {
  if (hasAdultInSet) return true;

  const LIMIT_CHILD = 16 * 60; // 960
  const LIMIT_YOUNG = 18 * 60; // 1080

  // Adult 0 かつ Child を含む場合、終了が16:00を超えると全員NG
  if (hasChildInSet) {
    if (endMinutes > LIMIT_CHILD) {
      return false; // 全員NG（この関数は個別 ticket に対して false を返す）
    }
    return true;
  }

  // Adult 0 かつ Young（のみ）の場合、終了が18:00を超えるYoungはNG
  if (t.age === 'Young') {
    return endMinutes <= LIMIT_YOUNG;
  }

  // その他（Adult でないが Child も含まない = 例えば Young 以外は通常問題なし）
  return true;
};

/**
 * 理由の順序を安定化（README: 「同伴 → 年齢 → 座席」）
 */
const orderReasons = (reasons: string[]): string[] => {
  if (reasons.length <= 1) return reasons;
  const priority: Record<string, number> = {
    [MSG.NEED_ADULT]: 0,
    [MSG.AGE_LIMIT]: 1,
    [MSG.SEAT_LIMIT]: 2,
  };
  // 安定ソート：同一優先度は元の順序を維持
  return reasons
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const pa = priority[a.r] ?? 99;
      const pb = priority[b.r] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.i - b.i;
    })
    .map((x) => x.r);
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
