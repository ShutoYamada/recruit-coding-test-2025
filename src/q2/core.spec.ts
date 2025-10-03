import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
    ]);
    expect(rows.length).toBe(1);
  });
  // [C1] パース：壊れた行をスキップ（カラム不足/非数）
  it('parseLines: header / extra columns / non-numeric / invalid timestamp are skipped', () => {
    const rows = parseLines([
      'timestamp,userId,path,status,latencyMs', // header
      '2025-01-01T00:00:00Z,u1,/ok,200,100',
      '2025-01-01T00:00:00Z,u2,/bad,OK,100', // non-numeric status
      '2025-01-01T00:00:00Z,u3,/bad,200,NaN', // non-numeric latency
      'not-a-time,u4,/bad,200,100', // invalid timestamp
      '2025-01-01T00:00:00Z,u5,/bad,200,100,EXTRA', // extra column (skip per current policy)
    ]);
    // Only the valid one remains
    expect(rows).toEqual([
      {
        timestamp: '2025-01-01T00:00:00Z',
        userId: 'u1',
        path: '/ok',
        status: 200,
        latencyMs: 100,
      },
    ]);
  });

  // [C2] 期間フィルタ：from/to の 境界含む / 範囲外除外
  it('filterByDate: inclusive boundaries with milliseconds [from <= t < to+1d]', () => {
    const lines = [
      '2024-12-31T23:59:59.999Z,u0,/x,200,100', // before from -> excluded
      '2025-01-01T00:00:00.000Z,u1,/x,200,100', // from -> included
      '2025-01-31T23:59:59.999Z,u2,/x,200,100', // just before to+1d -> included
      '2025-02-01T00:00:00.000Z,u3,/x,200,100', // to+1d -> excluded
    ];
    const out = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 10,
    });
    // All included lines are same path/date after tz; count should be 2
    const totalCount = out.reduce((s, r) => s + r.count, 0);
    expect(totalCount).toBe(2);
  });

  // [C3] タイムゾーン：UTC→JST/ICT の変換で 日付跨ぎが正しい
  it('TZ: UTC→JST date crossing is correct', () => {
    const lines = [
      // JST = UTC+9
      '2025-01-01T01:00:00Z,u1,/a,200,100', // JST 2025-01-01
      '2025-01-01T16:30:00Z,u2,/a,200,100', // JST 2025-01-02 (cross-day)
    ];
    const out = aggregate(lines, {
      from: '2024-12-31',
      to: '2025-01-03',
      tz: 'jst',
      top: 10,
    });
    // 同一のpathで2つの異なる日付になることを確認
    const dates = out.map((r) => r.date);
    expect(new Set(dates)).toEqual(new Set(['2025-01-01', '2025-01-02']));
  });

  it('TZ: UTC→ICT date crossing is correct', () => {
    const lines = [
      // ICT = UTC+7
      '2025-01-01T01:00:00Z,u1,/a,200,100', // ICT 2025-01-01 08:00 → 2025-01-01
      '2025-01-01T17:30:00Z,u2,/a,200,100', // ICT 2025-01-02 00:30 → 2025-01-02 (cross-day)
    ];
    const out = aggregate(lines, {
      from: '2024-12-31',
      to: '2025-01-03',
      tz: 'ict',
      top: 10,
    });
    const dates = out.map((r) => r.date);
    expect(new Set(dates)).toEqual(new Set(['2025-01-01', '2025-01-02']));
  });

  // [C4] 集計：date×path の件数・平均が合う
  // [C5] 上位N：日付ごとに count 降順、同数は path 昇順
  // [C6] 出力順：date ASC, count DESC, path ASC の 決定的順序
  // [C7] サンプル拡張：同一日複数パス/同数タイ/大きめデータ
});
