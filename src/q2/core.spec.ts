// src/q2/core.spec.ts
import { describe, expect, it } from "vitest";
import { aggregate, parseLines } from "./core.js";

describe("Q2 core", () => {
  it("parseLines: skips broken rows", () => {
    // 壊れた行 (項目数が足りない) をスキップできること
    const rows = parseLines([
      "2025-01-03T10:12:00Z,u1,/a,200,100", // 正常行
      "broken,row,only,three", // 不正行 (項目不足)
    ]);
    expect(rows.length).toBe(1);
  });

  it("parseLines: skips rows with non-numeric status/latency", () => {
    // status または latency が数値に変換できない場合はスキップされる
    const rows = parseLines([
      "2025-01-03T10:12:00Z,u1,/a,200,100", // OK
      "2025-01-03T10:12:00Z,u2,/b,abc,100", // status が不正
      "2025-01-03T10:12:00Z,u3,/c,200,notanumber", // latency が不正
    ]);
    expect(rows.length).toBe(1);
  });

  it("aggregate basic (JST)", () => {
    // JST での日付変換と集計確認
    const lines = [
      "2025-01-01T23:00:00Z,u1,/a,200,100", // JST => 2025-01-02
      "2025-01-02T00:00:00Z,u2,/a,200,300", // JST => 2025-01-02
      "2025-01-02T01:00:00Z,u3,/b,500,400", // JST => 2025-01-02
      "2025-01-03T01:00:00Z,u4,/a,200,500", // JST => 2025-01-03
    ];
    const out = aggregate(lines, {
      from: "2025-01-01",
      to: "2025-01-03",
      tz: "jst",
      top: 2,
    });
    // /a は2件 (avgLatency=200), /b は1件, 2025-01-03 は1件
    expect(out).toEqual([
      { date: "2025-01-02", path: "/a", count: 2, avgLatency: 200 },
      { date: "2025-01-02", path: "/b", count: 1, avgLatency: 400 },
      { date: "2025-01-03", path: "/a", count: 1, avgLatency: 500 },
    ]);
  });

  it("aggregate respects tz=ict vs jst (date bucketing differs)", () => {
    // タイムゾーンによって日付が異なるケースを確認
    // UTC 2025-01-01T16:00:00Z → JST=2025-01-02, ICT=2025-01-01
    const lines = [
      "2025-01-01T16:00:00Z,u1,/p,200,100",
      "2025-01-01T18:00:00Z,u2,/p,200,200",
    ];
    const outJst = aggregate(lines, {
      from: "2025-01-01",
      to: "2025-01-03",
      tz: "jst",
      top: 10,
    });
    expect(outJst).toEqual([{ date: "2025-01-02", path: "/p", count: 2, avgLatency: 150 }]);

    const outIct = aggregate(lines, {
      from: "2025-01-01",
      to: "2025-01-03",
      tz: "ict",
      top: 10,
    });
    // ICT の場合は 2025-01-01 と 2025-01-02 に分かれる
    expect(outIct).toEqual([
      { date: "2025-01-01", path: "/p", count: 1, avgLatency: 100 },
      { date: "2025-01-02", path: "/p", count: 1, avgLatency: 200 },
    ]);
  });

  it("rankTop: top limit and tie-break (path lexicographic)", () => {
    // 件数が同じ場合は path の辞書順で決定される
    const lines = [
      "2025-01-02T00:00:00Z,u1,/b,200,100",
      "2025-01-02T00:01:00Z,u2,/a,200,100",
      "2025-01-02T00:02:00Z,u3,/b,200,100",
      "2025-01-02T00:03:00Z,u4,/a,200,100",
      "2025-01-02T00:04:00Z,u5,/c,200,100",
    ];
    const out = aggregate(lines, {
      from: "2025-01-01",
      to: "2025-01-03",
      tz: "jst",
      top: 2,
    });
    // /a と /b が件数=2, lex順で /a → /b
    expect(out).toEqual([
      { date: "2025-01-02", path: "/a", count: 2, avgLatency: 100 },
      { date: "2025-01-02", path: "/b", count: 2, avgLatency: 100 },
    ]);
  });

  it("filterByDate: respects from/to range", () => {
    // from=2025-01-02, to=2025-01-02 の場合、対象はその日のみ
    const lines = [
      "2025-01-01T10:00:00Z,u1,/a,200,100", // 範囲外
      "2025-01-02T10:00:00Z,u2,/a,200,200", // 範囲内
      "2025-01-03T10:00:00Z,u3,/a,200,300", // 範囲外
    ];
    const out = aggregate(lines, {
      from: "2025-01-02",
      to: "2025-01-02",
      tz: "jst",
      top: 10,
    });
    expect(out).toEqual([{ date: "2025-01-02", path: "/a", count: 1, avgLatency: 200 }]);
  });

  it("returns empty when top <= 0 or no data", () => {
    // データがない場合や top <= 0 の場合は空配列を返す
    const lines: string[] = [];
    expect(aggregate(lines, { from: "2025-01-01", to: "2025-01-02", tz: "jst", top: 10 })).toEqual([]);
    const sample = ["2025-01-02T00:00:00Z,u1,/a,200,100"];
    expect(aggregate(sample, { from: "2025-01-01", to: "2025-01-03", tz: "jst", top: 0 })).toEqual([]);
  });
});
