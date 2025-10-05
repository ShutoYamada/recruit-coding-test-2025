// solve 関数: 入力文字列を解析してチケットの可否と料金を返す
export function solve(input: string): string {
  // 空入力 → 不正
  if (!input) return "不正な入力です";

  // 行ごとに分割
  const lines = input.split("\n").map(l => l.trim()).filter(Boolean);

  // Ticket 型定義
  type Ticket = {
    type: "Adult" | "Young" | "Child";      // 区分
    rating: "G" | "PG-12" | "R18+";         // レーティング
    start: number;                          // 開始時刻 (分単位)
    end: number;                            // 終了時刻 (分単位)
    row: string;                            // 座席列
    col: number;                            // 座席番号
    errors: string[];                       // エラー理由
  };

  // 時刻文字列を分に変換
  const parseTime = (t: string): number | null => {
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(t);
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return h * 60 + mm;
  };

  const tickets: Ticket[] = [];
  let invalidInput = false;

  // 各行のパース処理
  for (const line of lines) {
    if (invalidInput) break;
    const parts = line.split(",").map(p => p.trim());
    if (parts.length !== 5) { invalidInput = true; break; }

    let [type, rating, startStr, durStr, seat] = parts;

    // 大文字小文字の正規化
    type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    rating = rating.toUpperCase();

    // 区分・レーティングの妥当性
    if (!["Adult", "Young", "Child"].includes(type)) { invalidInput = true; break; }
    if (!["G", "PG-12", "R18+"].includes(rating)) { invalidInput = true; break; }

    // 開始時刻
    const start = parseTime(startStr);
    if (start === null) { invalidInput = true; break; }

    // 上映時間 (分単位)
    const durationMatch = /^(\d+):(\d{1,2})$/.exec(durStr);
    if (!durationMatch) { invalidInput = true; break; }
    const dh = Number(durationMatch[1]);
    const dmm = Number(durationMatch[2]);
    if (dh <= 0 || dmm !== 0) { invalidInput = true; break; } // 時間が正整数で分が0でないとNG
    const duration = dh * 60;
    const end = start + duration;

    // 座席 (A〜L, 1〜24)
    const seatMatch = /^([A-La-l])-(\d{1,2})$/.exec(seat);
    if (!seatMatch) { invalidInput = true; break; }
    const row = seatMatch[1].toUpperCase();
    const col = Number(seatMatch[2]);
    if (col < 1 || col > 24) { invalidInput = true; break; }

    // チケット登録
    tickets.push({
      type: type as Ticket['type'],
      rating: rating as Ticket['rating'],
      start,
      end,
      row,
      col,
      errors: []
    });
  }

  // 不正入力チェック
  if (invalidInput || tickets.length === 0) return "不正な入力です";

  // Adult 同伴有無
  const hasAdult = tickets.some(t => t.type === "Adult");

  // 各チケットごとの制約チェック
  for (const t of tickets) {
    // R18+ → Adult 以外 NG
    if (t.rating === "R18+" && t.type !== "Adult") {
      t.errors.push("対象の映画は年齢制限により閲覧できません");
    }
    // PG-12 → Child 単独 (Adult なし) NG
    if (t.rating === "PG-12" && t.type === "Child" && !hasAdult) {
      t.errors.push("対象の映画は年齢制限により閲覧できません");
    }
    // Child の座席制限 (J, K, L 不可)
    if (t.type === "Child" && ["J", "K", "L"].includes(t.row)) {
      t.errors.push("対象のチケットではその座席をご利用いただけません");
    }
    // 同伴制限 (Adult 不在の場合のみ)
    if (!hasAdult) {
      if (t.type === "Child" && t.end > 16 * 60) {
        t.errors.push("対象の映画の入場には大人の同伴が必要です");
      }
      if (t.type === "Young" && t.end > 18 * 60) {
        t.errors.push("対象の映画の入場には大人の同伴が必要です");
      }
    }
    // エラーの出力順序を固定
    const order = [
      "対象の映画の入場には大人の同伴が必要です",
      "対象の映画は年齢制限により閲覧できません",
      "対象のチケットではその座席をご利用いただけません"
    ];
    t.errors.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }

  // NGチケットが存在する場合 → エラーのみ返す
  const someNG = tickets.some(t => t.errors.length > 0);
  if (someNG) {
    return tickets
      .filter(t => t.errors.length > 0)
      .map(t => t.errors.join(","))
      .join("\n");
  }

  // 価格マップ
  const priceMap: Record<Ticket['type'], string> = {
    Adult: "1800円",
    Young: "1200円",
    Child: "800円"
  };
  // 料金を行ごとに出力
  return tickets.map(t => priceMap[t.type]).join("\n");
}
