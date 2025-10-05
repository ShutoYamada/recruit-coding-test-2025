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

// 年齢ごとの基本料金
const PRICE: Record<Age, number> = { Adult: 1800, Young: 1200, Child: 800 };

// 出力メッセージ（テストと同一文字列に揃える）
const MSG = {
  NEED_ADULT: '対象の映画の入場には大人の同伴が必要です',
  AGE_LIMIT: '対象の映画は年齢制限により閲覧できません',
  SEAT_LIMIT: '対象のチケットではその座席をご利用いただけません',
} as const;

/**
 * solve関数の概要：
 *  - 各行（チケット）をパースして検証する
 *  - OKなら金額、NGなら理由（カンマ区切り）を出力
 *  - 1枚でもNGがあれば「全体購入不可」として理由のみを出力
 *  - 理由は「同伴 → 年齢制限 → 座席制限」の順に表示
 */
export const solve = (input: string): string => {
  const lines = input
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';

  const tickets: Ticket[] = [];
  for (const line of lines) {
    const t = parseLine(line);
    if (!t) return '不正な入力です';
    tickets.push(t);
  }

  const hasAdult = tickets.some((t) => t.age === 'Adult');
  const hasChild = tickets.some((t) => t.age === 'Child');
  const rating = tickets[0].rating;
  const endMinutes = calcEndMinutes(tickets[0]); // 全チケット同一上映前提

  const evaluated: { ok: boolean; text: string }[] = [];
  let anyNg = false;

  for (const t of tickets) {
    const reasons: string[] = [];

    // 各種チェック（順序は後で整列）
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

  // 「全体購入不可」なら価格を出さずに理由のみを表示
  if (anyNg) {
    return evaluated.map((e) => e.text).join('\n');
  }

  return evaluated.map((e) => e.text).join('\n');
};

/**
 * 入力パース（簡易チェック付き）
 * TODO: 範囲チェックなどを追加する場合はここに
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

  // 時刻と座席の範囲を確認
  if (startHH < 0 || startHH > 23) return null;
  if (startMM < 0 || startMM > 59) return null;
  if (durH < 0) return null;
  if (durM < 0 || durM > 59) return null;
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
  return start + t.durH * 60 + t.durM;
};

/**
 * レーティングに関するチェック
 *  - G      : 全員OK
 *  - PG-12  : Child は Adult 同伴が必要
 *  - R18+   : Adult のみOK
 */
const checkRating = (
  age: Age,
  rating: Rating,
  hasAdultInSet: boolean
): boolean => {
  if (rating === 'G') return true;
  if (rating === 'PG-12') {
    if (age === 'Child' && !hasAdultInSet) return false;
    return true;
  }
  if (rating === 'R18+') {
    return age === 'Adult';
  }
  return true;
};

/**
 * 座席のチェック
 *  - J〜L の座席は Child 利用不可
 */
const checkSeat = (t: Ticket): boolean => {
  if (t.age === 'Child' && ['J', 'K', 'L'].includes(t.row)) {
    return false;
  }
  return true;
};

/**
 * 上映終了時刻と年齢構成による制限チェック
 *  - Adult がいれば常にOK
 *  - Adult なしで Child を含む → 終了16:00超なら全員NG
 *  - Adult なしで Young のみ → 終了18:00超ならNG
 *  - ちょうど16:00/18:00はOK
 */
const checkTimeRule = (
  t: Ticket,
  endMinutes: number,
  hasAdultInSet: boolean,
  hasChildInSet: boolean
): boolean => {
  if (hasAdultInSet) return true;
  if (hasChildInSet) {
    return endMinutes <= 16 * 60;
  }
  if (t.age === 'Young') {
    return endMinutes <= 18 * 60;
  }
  return true;
};

/**
 * 理由の優先順位を統一
 * 表示順: 同伴必要 → 年齢制限 → 座席制限
 */
const orderReasons = (reasons: string[]): string[] => {
  const order = [MSG.NEED_ADULT, MSG.AGE_LIMIT, MSG.SEAT_LIMIT] as const;
  return [...reasons].sort(
    (a, b) =>
      order.indexOf(a as typeof order[number]) -
      order.indexOf(b as typeof order[number])
  );
};

/**
 * 配列から重複を除外（順序維持）
 */
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
