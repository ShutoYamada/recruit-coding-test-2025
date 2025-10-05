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
 */
export const solve = (input: string): string => {
  const lines = input
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 空入力は空出力
  if (lines.length === 0) return '';

  // 入力をパース（不正なら即終了）
  const tickets: Ticket[] = [];
  for (const line of lines) {
    const t = parseLine(line);
    if (!t) return '不正な入力です';
    tickets.push(t);
  }

  // 全チケットが同じ上映であることを確認（同一rating、同一開始時刻・時間）
  const firstTicket = tickets[0];
  for (let i = 1; i < tickets.length; i++) {
    const t = tickets[i];
    if (
      t.rating !== firstTicket.rating ||
      t.startHH !== firstTicket.startHH ||
      t.startMM !== firstTicket.startMM ||
      t.durH !== firstTicket.durH ||
      t.durM !== firstTicket.durM
    ) {
      return '不正な入力です'; // 異なる上映
    }
  }

  // セット属性（同一上映前提）
  const hasAdult = tickets.some((t) => t.age === 'Adult');
  const hasChild = tickets.some((t) => t.age === 'Child');
  const rating = firstTicket.rating;
  const endMinutes = calcEndMinutes(firstTicket); // 終了時刻（分）

  // 各行の評価
  const evaluated: { ok: boolean; text: string }[] = [];
  let anyNg = false;

  for (const t of tickets) {
    const reasons: string[] = [];

    // 同伴必要（終了時刻ベース）
    if (!checkTimeRule(t, endMinutes, hasAdult, hasChild)) {
      reasons.push(MSG.NEED_ADULT);
    }
    // 年齢制限（レーティング）
    if (!checkRating(t.age, rating, hasAdult)) {
      reasons.push(MSG.AGE_LIMIT);
    }
    // 座席制限
    if (!checkSeat(t)) {
      reasons.push(MSG.SEAT_LIMIT);
    }

    const ordered = orderReasons(uniqueStable(reasons));

    if (ordered.length === 0) {
      evaluated.push({ ok: true, text: `${PRICE[t.age]}円` });
    } else {
      anyNg = true;
      evaluated.push({ ok: false, text: ordered.join(',') });
    }
  }

  // 「全体不可」のときは価格を出さず、NG行の理由だけを出力する
  if (anyNg) {
    return evaluated
      .filter((e) => !e.ok)
      .map((e) => e.text)
      .join('\n');
  }

  // 全てOK → 価格をそのまま出力
  return evaluated.map((e) => e.text).join('\n');
};

/**
 * 簡易パーサ
 * - startHH/startMM/durH/durM の範囲チェック
 * - 座席の列番号 1-24 の範囲チェック
 */
const parseLine = (line: string): Ticket | null => {
  const parts = line.split(',').map((s) => s.trim());
  if (parts.length !== 5) return null;

  const [ageRaw, ratingRaw, startRaw, durRaw, seatRaw] = parts;

  if (!['Adult', 'Young', 'Child'].includes(ageRaw)) return null;
  if (!['G', 'PG-12', 'R18+'].includes(ratingRaw)) return null;

  // 分は 00-59 に限定、時は 0-23 を後でチェック
  const start = startRaw.match(/^(\d{1,2}):([0-5]\d)$/);
  const dur = durRaw.match(/^(\d{1,2}):([0-5]\d)$/);
  const seat = seatRaw.match(/^([A-L])-(\d{1,2})$/i);
  if (!start || !dur || !seat) return null;

  const startHH = parseInt(start[1], 10);
  const startMM = parseInt(start[2], 10);
  const durH = parseInt(dur[1], 10);
  const durM = parseInt(dur[2], 10);
  const row = seat[1].toUpperCase();
  const col = parseInt(seat[2], 10);

  // 範囲チェック
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
  const end = start + t.durH * 60 + t.durM;
  return end;
};

/**
 * 年齢/レーティングの規則
 *  - G: 誰でも可
 *  - PG-12: Child は Adult 同時購入がなければ不可（Young は単独OK）
 *  - R18+: Adult 以外は不可
 */
const checkRating = (
  age: Age,
  rating: Rating,
  hasAdultInSet: boolean
): boolean => {
  if (rating === 'G') return true; // 制限なし
  if (rating === 'R18+') return age === 'Adult'; // 大人のみ可
  // PG-12
  if (rating === 'PG-12') {
    if (age === 'Child' && !hasAdultInSet) return false; // 子供は大人同伴が必須
    return true; // Young / Adult は OK
  }
  return true;
};

/**
 * 座席の規則
 *  - J〜L は Child 不可
 */
const checkSeat = (t: Ticket): boolean => {
  if (t.age !== 'Child') return true;
  return !(t.row === 'J' || t.row === 'K' || t.row === 'L');
};

/**
 * 時刻の規則（終了時刻ベース）
 *  - Adult がいれば常にOK
 *  - Adult が 0 かつ Child を含み、終了が 16:00 を超える → Young も含め全員 NG
 *  - Adult が 0 で Child なし（Young のみ等）、終了が 18:00 を超える Young は NG
 *  - ちょうど 16:00/18:00 は OK
 */
const checkTimeRule = (
  t: Ticket,
  endMinutes: number,
  hasAdultInSet: boolean,
  hasChildInSet: boolean
): boolean => {
  if (hasAdultInSet) return true; // 大人が1枚でもあれば時間帯規制は免除

  const MIN_16_00 = 16 * 60; // 960
  const MIN_18_00 = 18 * 60; // 1080

  // 子供が含まれていて、終了 > 16:00 の作品は全員 NG（Young も不可）
  if (hasChildInSet && endMinutes > MIN_16_00) {
    return false;
  }

  // 子供がいない（Young のみ等）の場合、終了 > 18:00 の Young は NG
  if (!hasChildInSet && t.age === 'Young' && endMinutes > MIN_18_00) {
    return false;
  }

  // Adult 自身は時間制限なし（念のため明示）
  if (t.age === 'Adult') return true;

  // ちょうど 16:00 / 18:00 は許可
  return true;
};

/**
 * 理由の順序を安定化（README: 「同伴 → 年齢 → 座席」）
 */
const orderReasons = (reasons: string[]): string[] => {
  const pri = new Map<string, number>([
    [MSG.NEED_ADULT, 1],
    [MSG.AGE_LIMIT, 2],
    [MSG.SEAT_LIMIT, 3],
  ]);
  return [...reasons].sort((a, b) => {
    const pa = pri.get(a) ?? 99;
    const pb = pri.get(b) ?? 99;
    return pa - pb || a.localeCompare(b);
  });
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
