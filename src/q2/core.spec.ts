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
  it('Grouping & avgLatency rounding works on same date×path', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/a,200,100',
      '2025-01-03T10:10:00Z,u2,/a,200,101',
      '2025-01-03T10:20:00Z,u3,/a,200,102',
      '2025-01-03T11:00:00Z,u4,/b,200,100',
      '2025-01-03T11:10:00Z,u5,/b,200,101',
    ];
    const out = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-03',
      tz: 'jst',
      top: 10,
    });
    // Two entries: /a count=3 avg=101, /b count=2 avg=101
    const a = out.find((r) => r.path === '/a');
    const b = out.find((r) => r.path === '/b');
    expect(a).toEqual({
      date: '2025-01-03',
      path: '/a',
      count: 3,
      avgLatency: 101,
    });
    expect(b).toEqual({
      date: '2025-01-03',
      path: '/b',
      count: 2,
      avgLatency: 101,
    });
  });

  // [C5] 上位N：日付ごとに count 降順、同数は path 昇順
  it('Top-N by date with path tie-break (count desc, path asc)', () => {
    const lines = [
      '2025-01-05T00:00:00Z,u1,/a,200,100',
      '2025-01-05T00:10:00Z,u2,/a,200,100',
      '2025-01-05T00:20:00Z,u3,/a,200,100', // /a count=3
      '2025-01-05T01:00:00Z,u4,/b,200,100',
      '2025-01-05T01:10:00Z,u5,/b,200,100',
      '2025-01-05T01:20:00Z,u6,/b,200,100', // /b count=3 (tie with /a)
      '2025-01-05T02:00:00Z,u7,/c,200,100',
      '2025-01-05T02:10:00Z,u8,/c,200,100', // /c count=2
      '2025-01-05T03:00:00Z,u9,/d,200,100', // /d count=1
    ];
    const out = aggregate(lines, {
      from: '2025-01-05',
      to: '2025-01-05',
      tz: 'ict', // any tz is fine; all same day
      top: 2,
    });
    // Per date top-2 should be /a and /b; when tie, /a comes before /b
    expect(out).toEqual([
      { date: '2025-01-05', path: '/a', count: 3, avgLatency: 100 },
      { date: '2025-01-05', path: '/b', count: 3, avgLatency: 100 },
    ]);
  });

  // [C6] 出力順：date ASC, count DESC, path ASC の 決定的順序
  // [C7] サンプル拡張：同一日複数パス/同数タイ/大きめデータ
});
