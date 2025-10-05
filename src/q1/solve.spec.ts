import { describe, expect, it } from "vitest";
import { solve } from "./solve.js";

// Q1 solve のテストケース
describe("Q1 solve", () => {
  // 型チェック: 戻り値が string
  it("test run check: returns string", () => {
    const out = solve("Adult,G,10:00,2:00,A-1");
    expect(typeof out).toBe("string");
  });

  // [C1] 基本料金のテスト: Adult/Young/Child
  it("[C1] Adult/Young/Child の価格が正しく出る", () => {
    expect(solve("Adult,G,10:00,2:00,A-1")).toBe("1800円");
    expect(solve("Young,G,10:00,2:00,A-1")).toBe("1200円");
    expect(solve("Child,G,10:00,2:00,A-1")).toBe("800円");
  });

  // [C1] 複数枚購入時: 行ごとに価格が出力される
  it("[C1] 全部OKの複数枚購入で価格が行ごとに出る", () => {
    const input = [
      "Adult,G,10:00,2:00,A-1",
      "Young,G,10:00,2:00,A-2",
      "Child,G,10:00,2:00,A-3"
    ].join("\n");
    expect(solve(input)).toBe(["1800円", "1200円", "800円"].join("\n"));
  });

  // [C2] 年齢制限チェック: R18+ Young/Child 購入不可
  it("[C2] R18+ を Young/Child で購入不可 → 年齢制限", () => {
    expect(solve("Young,R18+,10:00,2:00,A-1")).toBe("対象の映画は年齢制限により閲覧できません");
  });

  // [C2] PG-12 Child 単独購入不可
  it("[C2] PG-12 を Child 単独で購入不可（Adult 同時購入なし）", () => {
    expect(solve("Child,PG-12,10:00,2:00,A-1")).toBe("対象の映画は年齢制限により閲覧できません");
  });

  // [C2] PG-12 Adult + Child 同時購入ならOK
  it("[C2] PG-12 を Adult + Child 同時購入 → 両方購入可", () => {
    const input = ["Adult,PG-12,10:00,2:00,A-1", "Child,PG-12,10:00,2:00,A-2"].join("\n");
    expect(solve(input)).toBe(["1800円", "800円"].join("\n"));
  });

  // [C3] Child 座席制限: I可 / J不可 / L不可
  it("[C3] Child の I 行は購入可 / J 行は購入不可 / L 行は購入不可", () => {
    expect(solve("Child,G,10:00,2:00,I-1")).toBe("800円");
    expect(solve("Child,G,10:00,2:00,J-1")).toBe("対象のチケットではその座席をご利用いただけません");
    expect(solve("Child,G,10:00,2:00,L-1")).toBe("対象のチケットではその座席をご利用いただけません");
  });

  // [C4] Child の入場時間制限: 16:00まで可
  it("[C4] Child: 終了16:00ちょうどは可 / 16:01は同伴必要", () => {
    expect(solve("Child,G,14:00,2:00,A-1")).toBe("800円"); // end=16:00
    expect(solve("Child,G,14:01,2:00,A-1")).toBe("対象の映画の入場には大人の同伴が必要です"); // end=16:01
  });

  // [C4] Young の入場時間制限: 18:00まで可
  it("[C4] Young: 終了18:00ちょうどは可 / 18:01は同伴必要", () => {
    expect(solve("Young,G,16:00,2:00,A-1")).toBe("1200円"); // end=18:00
    expect(solve("Young,G,16:01,2:00,A-1")).toBe("対象の映画の入場には大人の同伴が必要です"); // end=18:01
  });

  // [C5] Adult 不在 + Young/Child 終了時間制限超過 → 全体NG
  it("[C5] Adult なし + Young & Child / 終了16:01超 → 両方 同伴必要 で全体不可", () => {
    const input = [
      "Young,G,16:30,2:00,A-1", // end=18:30
      "Child,G,15:30,2:00,A-2"  // end=17:30
    ].join("\n");
    const out = solve(input);
    expect(out).toBe(
      [
        "対象の映画の入場には大人の同伴が必要です",
        "対象の映画の入場には大人の同伴が必要です"
      ].join("\n")
    );
  });

  // [C5] Adult 追加で Young/Child 購入可能
  it("[C5] Adult を1枚追加で Young/Child とも購入可（同伴必要が消える）", () => {
    const input = [
      "Adult,G,16:30,2:00,A-1",
      "Young,G,16:30,2:00,A-2",
      "Child,G,15:30,2:00,A-3"
    ].join("\n");
    const out = solve(input);
    expect(out).toBe(["1800円", "1200円", "800円"].join("\n"));
  });

  // [C6] Child + PG-12 + J席 + Adultなし + 終了16:01 → 理由3つ
  it("[C6] Child + PG-12 + J席 + Adultなし + 終了16:01 → 理由3つ（順序固定）", () => {
    const out = solve("Child,PG-12,15:30,1:00,J-10"); // end=16:30
    expect(out).toBe(
      [
        "対象の映画の入場には大人の同伴が必要です",
        "対象の映画は年齢制限により閲覧できません",
        "対象のチケットではその座席をご利用いただけません"
      ].join(",")
    );
  });

  // [C6] PG-12 Child 単独（安全席・早い時刻）→ 年齢制限のみ
  it("[C6] PG-12 Child 単独（安全席・早い時刻）→ 年齢制限のみ", () => {
    const out = solve("Child,PG-12,10:00,1:00,A-1"); // end=11:00
    expect(out).toBe("対象の映画は年齢制限により閲覧できません");
  });

  // [C7] 1枚OK/1枚NG混在 → NG行のみ出力
  it("[C7] 1枚OK/1枚NG の混在 → NG行の理由だけを出力", () => {
    const input = [
      "Adult,G,10:00,2:00,A-1",
      "Child,G,15:30,2:00,L-1"
    ].join("\n");
    const out = solve(input);
    expect(out).toBe("対象のチケットではその座席をご利用いただけません");
  });

  // [C7] 全部NG → 各行の理由が並ぶ
  it("[C7] 全部NGなら全NG理由行が並ぶ（入力順）", () => {
    const input = [
      "Child,R18+,10:00,2:00,J-1",
      "Young,R18+,10:00,2:00,A-1"
    ].join("\n");
    const out = solve(input);
    expect(out).toBe(
      [
        "対象の映画は年齢制限により閲覧できません,対象のチケットではその座席をご利用いただけません",
        "対象の映画は年齢制限により閲覧できません"
      ].join("\n")
    );
  });

  // [C8] 不正入力チェック
  it("[C8] 未知の区分/レーティング/座席形式/カラム数不正 → 不正な入力です", () => {
    expect(solve("Alien,G,10:00,2:00,A-1")).toBe("不正な入力です");
    expect(solve("Adult,PG-13,10:00,2:00,A-1")).toBe("不正な入力です");
    expect(solve("Adult,G,25:00,2:00,A-1")).toBe("不正な入力です");
    expect(solve("Adult,G,10:00,2:30,A-1")).toBe("不正な入力です");
    expect(solve("Adult,G,10:00,2:00,Z-1")).toBe("不正な入力です");
    expect(solve("Adult,G,10:00,2:00,A-25")).toBe("不正な入力です");
  });

  // [C9] サンプル入力: 全部購入可 → 合計価格行
  it("[C9] input.txt のサンプル入力が全部購入可 → 合計価格行を返す", () => {
    const input = [
      "Adult,G,10:00,1:00,A-1",
      "Young,G,10:00,1:00,A-2",
      "Child,G,10:00,1:00,I-3"
    ].join("\n");
    const out = solve(input);
    expect(out).toBe(["1800円", "1200円", "800円"].join("\n"));
  });
});
