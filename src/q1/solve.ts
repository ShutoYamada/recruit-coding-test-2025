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
// 課題指定の文言そのまま。表示順は「同伴必要 → 年齢制限 → 座席制限」
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

  // 空入力なら空文字を返す（配線確認用）
  if (lines.length === 0) return '';

  // パースに失敗したら「不正な入力です」で即時終了（簡略仕様）
  const tickets: Ticket[] = [];
  for (const line of lines) {
    const t = parseLine(line);
    if (!t) return '不正な入力です';
    tickets.push(t);
  }

  // 同時購入は同一作品前提。代表として先頭チケットの rating / 終了時刻を用いる。
  const hasAdult = tickets.some((t) => t.age === 'Adult');
  const hasChild = tickets.some((t) => t.age === 'Child'); // C5 で使用（グループ規則）
  const rating = tickets[0].rating;
  const endMinutes = calcEndMinutes(tickets[0]); // 今年は日跨ぎなし前提

  // 各行の評価
  const evaluated: { ok: boolean; text: string; reasons: string[] }[] = [];
  let anyNg = false;

  // 全体理由の有無を集計するためのフラグ
  let trigNeedAdult = false;
  let trigAgeLimit = false;
  let trigSeatLimit = false;

  for (const t of tickets) {
    const reasons: string[] = [];

    // 理由の push 順は README の順序に合わせておく（後で orderReasons で厳密化）
    if (!checkTimeRule(t, endMinutes, hasAdult, hasChild)) {
      reasons.push(MSG.NEED_ADULT);
      trigNeedAdult = true;
    }
    if (!checkRating(t.age, rating, hasAdult)) {
      reasons.push(MSG.AGE_LIMIT);
      trigAgeLimit = true;
    }
    if (!checkSeat(t)) {
      reasons.push(MSG.SEAT_LIMIT);
      trigSeatLimit = true;
    }

    const ordered = orderReasons(reasons);

    if (ordered.length === 0) {
      evaluated.push({ ok: true, text: `${PRICE[t.age]}円`, reasons: [] });
    } else {
      anyNg = true;
      evaluated.push({
        ok: false,
        text: uniqueStable(ordered).join(','),
        reasons: uniqueStable(ordered),
      });
    }
  }

  // 「全体不可」のときは価格を出さず、NG行の理由だけを出力する
  if (anyNg) {
    return evaluated
      .filter((e) => !e.ok)
      .map((e) => e.text)
      .join('\n');
  }

  // 全て OK の場合は、各行の価格をそのまま出力
  return evaluated.map((e) => e.text).join('\n');
};

/**
 * 簡易パーサ（最小限の検証のみ）
 * TODO:
 *  - startHH/startMM/durH/durM の範囲チェック（例: 23:59, 分は 0-59）
 *  - 座席の列番号 1-24 の範囲チェック
 *  - その他フォーマットの揺れ（必要なら）
 *
 * 雛形の方針に合わせ、最小限の検証のみを行う。
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

  // 数値レンジ検証（雛形の TODO を実装）
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

// 終了時刻（分）＝開始分＋上映時間（分）／今年は日跨ぎなし前提。
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
 *
 * README のまま実装。
 */
const checkRating = (
  age: Age,
  rating: Rating,
  hasAdultInSet: boolean
): boolean => {
  if (rating === 'G') return true;
  if (rating === 'PG-12') {
    // Child 単独（= 同時購入に Adult がいない）なら NG
    if (age === 'Child' && !hasAdultInSet) return false;
    return true;
  }
  // R18+ は Adult のみ可
  if (rating === 'R18+') {
    return age === 'Adult';
  }
  return true;
};

/**
 * 座席の規則
 *  - J〜L は Child 不可
 *
 * Child が J/K/L 行なら NG。
 */
const checkSeat = (t: Ticket): boolean => {
  if (t.age !== 'Child') return true;
  const r = t.row.toUpperCase();
  if (r === 'J' || r === 'K' || r === 'L') return false;
  return true;
};

/**
 * 時刻の規則（終了時刻ベース）
 *  - Adult がいれば常にOK
 *  - Adult が 0 かつ Child を含み、終了が 16:00 を超える → Young も含め全員 NG
 *  - Adult が 0 で Young 単独など、終了が 18:00 を超える Young は NG
 *  - ちょうど 16:00/18:00 は OK
 *
 * endMinutes は代表（先頭チケット）から算出。今回は日跨ぎなし前提。
 */
const checkTimeRule = (
  t: Ticket,
  endMinutes: number,
  hasAdultInSet: boolean,
  hasChildInSet: boolean
): boolean => {
  if (hasAdultInSet) return true; // Adult 同伴がいれば常に OK

  // Adult がいない場合のみ、以下を検査
  const END_16 = 16 * 60;
  const END_18 = 18 * 60;

  if (hasChildInSet) {
    // 子供を含み、終了が 16:00 を超えると NG（16:00 ちょうどは OK）
    if (endMinutes > END_16) return false;
    return true;
  } else {
    // Young のみ等の場合、終了が 18:00 を超えると NG（18:00 ちょうどは OK）
    if (endMinutes > END_18) return false;
    return true;
  }
};

/**
 * 理由の順序を安定化（README: 「同伴 → 年齢 → 座席」）
 * 表示順固定のため、既知の3種類のみ並べ替える。
 */
const orderReasons = (reasons: string[]): string[] => {
  const hasNeed = reasons.includes(MSG.NEED_ADULT);
  const hasAge = reasons.includes(MSG.AGE_LIMIT);
  const hasSeat = reasons.includes(MSG.SEAT_LIMIT);
  const out: string[] = [];
  if (hasNeed) out.push(MSG.NEED_ADULT);
  if (hasAge) out.push(MSG.AGE_LIMIT);
  if (hasSeat) out.push(MSG.SEAT_LIMIT);
  return out;
};

// 重複排除（stable）
// 先に出たものを残し、後続の重複を捨てる。
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
