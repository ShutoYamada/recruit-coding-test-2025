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
  const hasYoung = tickets.some((t) => t.age === 'Young');
  const rating = tickets[0].rating;
  const endMinutes = calcEndMinutes(tickets[0]); // 今年は日跨ぎなし前提

  // 各行の評価 / Evaluate each line
  const evaluated: { ok: boolean; text: string }[] = [];
  let anyNg = false;

  for (const t of tickets) {
    const reasons: string[] = [];

    // 理由の push 順は README の順序に合わせておく（後で orderReasons で厳密化）/ Push reasons in the order specified in README (will refine with orderReasons later)
    if (!checkTimeRule(t, endMinutes, hasAdult, hasChild, hasYoung)) {
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

  // 全体不可の場合は、NG行の理由のみを出力  / If any ticket is NG, output only the reasons for NG tickets
  if (anyNg) {
    return evaluated
      .filter((e) => !e.ok)
      .map((e) => e.text)
      .join('\n');
  }

  // 全てOKの場合は価格を出力 / If all are OK, output prices
  return evaluated.map((e) => e.text).join('\n');
};

/**
 * 簡易パーサ（最小限の検証のみ） / Simple parser (minimal validation)
 * 入力行をパースしてTicketオブジェクトに変換 / Parse input line into Ticket object
 * バリデーションも実施 / Also performs validation
 *  - startHH/startMM/durH/durM の範囲チェック（例: 23:59, 分は 0-59) / startHH / startMM range check: ensures start time is valid (e.g. 23:59 is valid; 24:00 or 12:60 is invalid). durH / durM range check: ensures movie duration is realistic (minutes cannot exceed 59).
 *  - 座席の列番号 1-24 の範囲チェック / seat col range check: ensures seat column is within valid range (1-24).
 */
const parseLine = (line: string): Ticket | null => {
  const parts = line.split(',').map((s) => s.trim());
  if (parts.length !== 5) return null;

  const [ageRaw, ratingRaw, startRaw, durRaw, seatRaw] = parts;

  // 年齢区分のチェック / Check age category
  if (!['Adult', 'Young', 'Child'].includes(ageRaw)) return null;

  // レーティングのチェック / Check rating
  if (!['G', 'PG-12', 'R18+'].includes(ratingRaw)) return null;

  // 時刻フォーマットのチェック /   Check time format
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

  // 時刻の範囲チェック / Check time range
  if (startHH < 0 || startHH > 23) return null;
  if (startMM < 0 || startMM > 59) return null;
  if (durH < 0) return null;
  if (durM < 0 || durM > 59) return null;

  // 座席の範囲チェック / Check seat range
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

/**
 * 上映終了時刻を分単位で計算 / Calculate end time in minutes
 */
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
  if (rating === 'G') {
    return true; // 誰でも可 / Anyone can watch
  }

  if (rating === 'PG-12') {
    // Child は Adult 同時購入が必要 / Child needs to be accompanied by Adult
    if (age === 'Child' && !hasAdultInSet) {
      return false;
    }
    return true;
  }

  if (rating === 'R18+') {
    // Adult 以外は不可 / Only Adult can watch
    return age === 'Adult';
  }

  return true;
};

/**
 * 座席の規則 / Seat rules
 *  - A〜L は Adult/Young/Child 可 / A-L rows: Adult/Young/Child allowed
 *  - J〜L は Child 不可 / J-L rows: Child not allowed
 */
const checkSeat = (t: Ticket): boolean => {
  if (t.age === 'Child') {
    // J, K, L 行は Child 不可 / Child cannot sit in rows J, K, L
    if (t.row === 'J' || t.row === 'K' || t.row === 'L') {
      return false;
    }
  }
  return true;
};

/**
 * 時刻の規則（終了時刻ベース）
 * - Adult がいれば常にOK /  If there's an Adult, always OK
 * - Adult が 0 かつ Child を含み、終了が 16:00 を超える → Young も含め全員 NG / If no Adult and includes Child, and end time exceeds 16:00 → all including Young are NG
 * - Adult が 0 で Young 単独など、終了が 18:00 を超える Young は NG / If no Adult and only Young, end time exceeding 18:00 → Young is NG
 * - ちょうど 16:00/18:00 は OK / Exactly 16:00/18:00 is OK
 */
const checkTimeRule = (
  t: Ticket,
  endMinutes: number,
  hasAdultInSet: boolean,
  hasChildInSet: boolean,
  hasYoungInSet: boolean
): boolean => {
  // Adult がいる場合は常にOK / If there's an Adult, always OK
  if (hasAdultInSet) {
    return true;
  }

  // Adult がいない場合 / If no Adult in the group
  const end16 = 16 * 60; // 16:00 = 960分
  const end18 = 18 * 60; // 18:00 = 1080分

  // Child を含むグループで終了が 16:00 を超える場合 -> NG / If the group includes a child and the end time is later than 16:00 -> NG
  if (hasChildInSet && endMinutes > end16) {
    return false;
  }

  // Young を含むとChildがいないグループで終了が 18:00 を超える場合 -> NG / If the group includes Young but no Child and the end time is later than 18:00 -> NG
  if (!hasChildInSet && hasYoungInSet && endMinutes > end18) {
    return false;
  }

  // Young で終了が 18:00 を超える場合 -> NG / If only Young and the end time is later than 18:00 -> NG
  if (t.age === 'Young' && endMinutes > end18) {
    return false;
  }

  // Child で終了が 16:00 を超える場合 -> NG / If only Child and the end time is later than 16:00 -> NG
  if (t.age === 'Child' && endMinutes > end16) {
    return false;
  }

  return true;
};

/**
 * 理由の順序を安定化 / Stable order of reasons
 * 順序: 同伴必要 → 年齢制限 → 座席制限 / Order: Need Adult → Age Limit → Seat Limit
 */
const orderReasons = (reasons: string[]): string[] => {
  const order = [MSG.NEED_ADULT, MSG.AGE_LIMIT, MSG.SEAT_LIMIT];

  return order.filter((msg) => reasons.includes(msg));
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
