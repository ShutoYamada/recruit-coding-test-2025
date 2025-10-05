import { describe, expect, it } from 'vitest';
import { parseLines, aggregate } from './core.js';

describe('Q2 core', () => {
  // ============================================
  // [T1] パース：壊れた行のスキップ
  // ============================================
  it('[T1] parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three', // カラム不足
      '2025-01-03T10:13:00Z,u2,/b,200,', // latencyMs欠損
      '2025-01-03T10:14:00Z,u3,/c,abc,50', // status非数値
      '2025-01-03T10:15:00Z,u4,/d,200,xyz', // latencyMs非数値
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].userId).toBe('u1');
  });

  it('[T1] parseLines: handles empty input', () => {
    expect(parseLines([])).toEqual([]);
    expect(parseLines(['', '  ', '\t'])).toEqual([]);
  });

  // ============================================
  // [T2] 期間フィルタ：境界値含む/範囲外除外
  // ============================================
  it('[T2] aggregate: filters by date range (inclusive)', () => {
    const lines = [
      '2024-12-31T23:59:59Z,u1,/a,200,100', // 範囲外（前）
      '2025-01-01T00:00:00Z,u2,/b,200,100', // from境界（含む）
      '2025-01-15T12:00:00Z,u3,/c,200,100', // 範囲内
      '2025-01-31T23:59:59Z,u4,/d,200,100', // to境界（含む）
      '2025-02-01T00:00:00Z,u5,/e,200,100', // 範囲外（後）
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 10,
    });
    // 範囲外を除外し、3件のみ
    expect(result.length).toBe(3);
    expect(result.map((r) => r.path).sort()).toEqual(['/b', '/c', '/d']);
  });

  // ============================================
  // [T3] タイムゾーン：UTC→JST/ICT変換（日付跨ぎ）
  // ============================================
  it('[T3] aggregate: JST timezone conversion (date boundary)', () => {
    const lines = [
      // UTC 2025-01-03 23:00 → JST 2025-01-04 08:00
      '2025-01-03T23:00:00Z,u1,/api/orders,200,100',
      // UTC 2025-01-04 00:00 → JST 2025-01-04 09:00
      '2025-01-04T00:00:00Z,u2,/api/orders,200,200',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 10,
    });
    // 両方とも JST では 2025-01-04
    expect(result.length).toBe(1);
    expect(result[0].date).toBe('2025-01-04');
    expect(result[0].count).toBe(2);
    expect(result[0].avgLatency).toBe(150); // (100+200)/2=150
  });

  it('[T3] aggregate: ICT timezone conversion', () => {
    const lines = [
      // UTC 2025-01-03 18:00 → ICT 2025-01-04 01:00
      '2025-01-03T18:00:00Z,u1,/api,200,100',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'ict',
      top: 10,
    });
    expect(result[0].date).toBe('2025-01-04');
  });

  // ============================================
  // [T4] 集計：date×pathごとの件数・平均
  // ============================================
  it('[T4] aggregate: counts and average latency per date×path', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/api/orders,200,100',
      '2025-01-03T11:00:00Z,u2,/api/orders,200,200',
      '2025-01-03T12:00:00Z,u3,/api/users,200,150',
      '2025-01-04T10:00:00Z,u4,/api/orders,200,300',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 10,
    });
    // JST: すべて日付変わらず
    // 2025-01-03: /api/orders (count=2, avg=150), /api/users (count=1, avg=150)
    // 2025-01-04: /api/orders (count=1, avg=300)
    expect(result.length).toBe(3);

    const jan03Orders = result.find(
      (r) => r.date === '2025-01-03' && r.path === '/api/orders'
    );
    expect(jan03Orders?.count).toBe(2);
    expect(jan03Orders?.avgLatency).toBe(150); // (100+200)/2=150
  });

  it('[T4] aggregate: rounds average latency correctly', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/api,200,100',
      '2025-01-03T11:00:00Z,u2,/api,200,101',
      '2025-01-03T12:00:00Z,u3,/api,200,102',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 10,
    });
    // (100+101+102)/3=101
    expect(result[0].avgLatency).toBe(101);
  });

  // ============================================
  // [T5] 上位N：日付ごとにcount降順、同数はpath昇順
  // ============================================
  it('[T5] aggregate: top N per date by count DESC, path ASC', () => {
    const lines = [
      // 2025-01-03 (JST)
      '2025-01-03T10:00:00Z,u1,/api/a,200,100',
      '2025-01-03T10:01:00Z,u2,/api/a,200,100',
      '2025-01-03T10:02:00Z,u3,/api/a,200,100', // count=3
      '2025-01-03T10:03:00Z,u4,/api/b,200,100',
      '2025-01-03T10:04:00Z,u5,/api/b,200,100', // count=2
      '2025-01-03T10:05:00Z,u6,/api/c,200,100', // count=1
      '2025-01-03T10:06:00Z,u7,/api/d,200,100', // count=1
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 3,
    });
    // top=3なので、count降順で /api/a(3), /api/b(2), /api/c(1)
    // /api/dは除外される
    expect(result.length).toBe(3);
    expect(result[0].path).toBe('/api/a');
    expect(result[0].count).toBe(3);
    expect(result[1].path).toBe('/api/b');
    expect(result[1].count).toBe(2);
    expect(result[2].path).toBe('/api/c');
    expect(result[2].count).toBe(1);
  });

  it('[T5] aggregate: tie-breaking by path ASC when count equal', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/api/z,200,100',
      '2025-01-03T10:01:00Z,u2,/api/a,200,100',
      '2025-01-03T10:02:00Z,u3,/api/m,200,100',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 2,
    });
    // 全て count=1、path昇順で /api/a, /api/m が選ばれる
    expect(result.length).toBe(2);
    expect(result[0].path).toBe('/api/a');
    expect(result[1].path).toBe('/api/m');
  });

  // ============================================
  // [T6] 出力順：date ASC, count DESC, path ASC
  // ============================================
  it('[T6] aggregate: output order is date ASC, count DESC, path ASC', () => {
    const lines = [
      // 2025-01-04
      '2025-01-04T10:00:00Z,u1,/api/b,200,100',
      '2025-01-04T10:01:00Z,u2,/api/a,200,100',
      '2025-01-04T10:02:00Z,u3,/api/a,200,100', // count=2
      // 2025-01-03
      '2025-01-03T10:00:00Z,u4,/api/x,200,100',
      '2025-01-03T10:01:00Z,u5,/api/x,200,100',
      '2025-01-03T10:02:00Z,u6,/api/x,200,100', // count=3
      '2025-01-03T10:03:00Z,u7,/api/y,200,100', // count=1
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 10,
    });
    // 期待順序:
    // 2025-01-03: /api/x(3), /api/y(1)
    // 2025-01-04: /api/a(2), /api/b(1)
    expect(result.length).toBe(4);
    expect(result[0].date).toBe('2025-01-03');
    expect(result[0].path).toBe('/api/x');
    expect(result[0].count).toBe(3);
    expect(result[1].date).toBe('2025-01-03');
    expect(result[1].path).toBe('/api/y');
    expect(result[2].date).toBe('2025-01-04');
    expect(result[2].path).toBe('/api/a');
    expect(result[2].count).toBe(2);
    expect(result[3].date).toBe('2025-01-04');
    expect(result[3].path).toBe('/api/b');
  });

  // ============================================
  // [T7] 統合：サンプルデータ拡張
  // ============================================
  it('[T7] aggregate: sample.csv scenario', () => {
    const lines = [
      '2025-01-03T10:12:00Z,u1,/api/orders,200,120',
      '2025-01-03T10:13:00Z,u2,/api/orders,200,180',
      '2025-01-03T11:00:00Z,u3,/api/users,200,90',
      '2025-01-04T00:10:00Z,u1,/api/orders,200,110',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 3,
    });
    // JST変換後:
    // 2025-01-03: /api/orders(2, avg=150), /api/users(1, avg=90)
    // 2025-01-04: /api/orders(1, avg=110)
    expect(result.length).toBe(3);

    expect(result[0].date).toBe('2025-01-03');
    expect(result[0].path).toBe('/api/orders');
    expect(result[0].count).toBe(2);
    expect(result[0].avgLatency).toBe(150);

    expect(result[1].date).toBe('2025-01-03');
    expect(result[1].path).toBe('/api/users');
    expect(result[1].count).toBe(1);
    expect(result[1].avgLatency).toBe(90);

    expect(result[2].date).toBe('2025-01-04');
    expect(result[2].path).toBe('/api/orders');
    expect(result[2].count).toBe(1);
    expect(result[2].avgLatency).toBe(110);
  });
});
