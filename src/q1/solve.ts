// file: solve.ts
type AgeCategory = "Adult" | "Young" | "Child";
type Rating = "G" | "PG-12" | "R18+";

interface TicketInput {
  age: AgeCategory;
  rating: Rating;
  startTime: string;
  duration: string;
  seat: string;
}

/**
 * 時刻文字列 "hh:mm" を分単位に変換
 */
function parseTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 上映時間 "h:mm" を分単位に変換
 */
function parseDuration(duration: string): number {
  const [hours, minutes] = duration.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 年齢区分からチケット価格を返す
 */
function calcPrice(age: AgeCategory): number {
  if (age === "Adult") return 1800;
  if (age === "Young") return 1200;
  return 800; // Child
}

/**
 * 映画館チケット購入処理
 */
export function solve(input: string): string {
  if (!input.trim()) return "";

  const lines = input.trim().split("\n");
  const tickets: TicketInput[] = [];

  // --- 入力解析 ---
  for (const line of lines) {
    const parts = line.split(",").map(s => s.trim());
    if (parts.length !== 5) return "不正な入力です";

    const [age, rating, startTime, duration, seat] = parts;

    // 年齢区分チェック
    if (!["Adult", "Young", "Child"].includes(age)) return "不正な入力です";
    // レーティングチェック
    if (!["G", "PG-12", "R18+"].includes(rating)) return "不正な入力です";
    // 座席形式チェック
    if (!/^[A-L]-?\d{1,2}$/.test(seat)) return "不正な入力です";

    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [durationHours, durationMinutes] = duration.split(":").map(Number);
    if (
      startHours < 0 || startHours > 23 ||
      startMinutes < 0 || startMinutes > 59 ||
      durationHours < 0 || durationMinutes >= 60
    ) return "不正な入力です";

    const seatColumn = parseInt(seat.replace(/^[A-L]-?/, ""));
    if (seatColumn < 1 || seatColumn > 24) return "不正な入力です";

    tickets.push({
      age: age as AgeCategory,
      rating: rating as Rating,
      startTime,
      duration,
      seat
    });
  }

  // --- Adult チケットがあるかチェック ---
  const hasAdult = tickets.some(t => t.age === "Adult");

  // --- Child >16:00 の場合の全体NGフラグ ---
  let allNGSet: boolean = false;
  if (!hasAdult) {
    const childLate = tickets.some(t =>
      t.age === "Child" && parseTime(t.startTime) + parseDuration(t.duration) > 16 * 60
    );
    if (childLate) allNGSet = true;
  }

  const outputs: string[] = [];

  for (const ticket of tickets) {
    const errors: string[] = [];
    const seatRow = ticket.seat[0].toUpperCase();
    const startMinutesTotal = parseTime(ticket.startTime);
    const durationMinutesTotal = parseDuration(ticket.duration);
    const endTime = startMinutesTotal + durationMinutesTotal;

    // --- 同伴必要チェック ---
    if (allNGSet) {
      errors.push("対象の映画の入場には大人の同伴が必要です");
    } else {
      if (ticket.age === "Child" && !hasAdult && endTime > 16 * 60) {
        errors.push("対象の映画の入場には大人の同伴が必要です");
      }
      if (ticket.age === "Young" && !hasAdult && endTime > 18 * 60) {
        errors.push("対象の映画の入場には大人の同伴が必要です");
      }
    }

    // --- 年齢制限チェック ---
    if (ticket.rating === "R18+" && ticket.age !== "Adult") {
      errors.push("対象の映画は年齢制限により閲覧できません");
    }
    if (ticket.rating === "PG-12" && ticket.age === "Child" && !hasAdult) {
      errors.push("対象の映画は年齢制限により閲覧できません");
    }

    // --- 座席制限チェック ---
    if (["J", "K", "L"].includes(seatRow) && ticket.age === "Child") {
      errors.push("対象のチケットではその座席をご利用いただけません");
    }

    // --- エラー順序: 同伴 → 年齢制限 → 座席 ---
    const order = [
      "対象の映画の入場には大人の同伴が必要です",
      "対象の映画は年齢制限により閲覧できません",
      "対象のチケットではその座席をご利用いただけません",
    ];
    const sortedErrors = order.filter(msg => errors.includes(msg));

    outputs.push(sortedErrors.length > 0 ? sortedErrors.join(",") : `${calcPrice(ticket.age)}円`);
  }

  // --- 全体不可ならNG行のみ出力 ---
  const ngLines = outputs.filter(o => !o.endsWith("円"));
  const okLines = outputs.filter(o => o.endsWith("円"));

  if (ngLines.length > 0) return ngLines.join("\n");

  // --- 全部OKなら価格行を出力 ---
  return okLines.join("\n");
}
