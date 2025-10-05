import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three', // 4列のみ
      '2025-01-03T10:13:00Z,u2,/b,200,abc', // latency非数値
      '2025-01-03T10:14:00Z,u3,/c,notnum,150', // status非数値
      'invalid-timestamp,u4,/d,200,100', // 不正なtimestamp
      ',u5,/e,200,100', // timestamp空
      '2025-01-03T10:15:00Z,,/f,200,100', // userId空
      '2025-01-03T10:16:00Z,u6,,200,100', // path空
      '2025-01-03T10:17:00Z,u7,/g,200,200', // 正常
    ]);
    expect(rows.length).toBe(2); // 最初と最後のみ有効
    expect(rows[0].userId).toBe('u1');
    expect(rows[1].userId).toBe('u7');
  });

  it('aggregate basic functionality', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs', // header行
      '2025-01-03T10:12:00Z,u1,/api/orders,200,120',
      '2025-01-03T10:13:00Z,u2,/api/orders,200,180',
      '2025-01-03T11:00:00Z,u3,/api/users,200,90',
      '2025-01-04T00:10:00Z,u1,/api/orders,200,110',
    ];

    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-04',
      tz: 'jst',
      top: 5,
    });

    expect(result).toHaveLength(3);
    // JST で 2025-01-03: /api/orders (count=2, avg=(120+180)/2=150), /api/users (count=1, avg=90)
    // JST で 2025-01-04: /api/orders (count=1, avg=110)

    // 結果の順序確認: date ASC, count DESC, path ASC
    expect(result[0]).toEqual({
      date: '2025-01-03',
      path: '/api/orders',
      count: 2,
      avgLatency: 150,
    });
    expect(result[1]).toEqual({
      date: '2025-01-03',
      path: '/api/users',
      count: 1,
      avgLatency: 90,
    });
    expect(result[2]).toEqual({
      date: '2025-01-04',
      path: '/api/orders',
      count: 1,
      avgLatency: 110,
    });
  });
});

// テストデータ作成用のヘルパー関数
function createLargeTestDataset(): string[] {
  return [
    'timestamp,userId,path,status,latencyMs',
    // 1日目: 同一カウントのパスが複数
    '2025-01-03T10:00:00Z,u1,/z-api,200,100', // カウント=1
    '2025-01-03T10:01:00Z,u2,/a-api,200,150', // カウント=1
    '2025-01-03T10:02:00Z,u3,/m-api,200,200', // カウント=1
    '2025-01-03T10:03:00Z,u4,/popular,200,50',
    '2025-01-03T10:04:00Z,u5,/popular,200,75',
    '2025-01-03T10:05:00Z,u6,/popular,200,100', // カウント=3, 最多
    // 2日目: 異なる分布
    '2025-01-04T10:00:00Z,u7,/beta,200,80',
    '2025-01-04T10:01:00Z,u8,/beta,200,120', // カウント=2
    '2025-01-04T10:02:00Z,u9,/alpha,200,90', // カウント=1
  ];
}

describe('Q2 parseLines comprehensive', () => {
  it('handles various timestamp formats', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      '2025-01-03T10:12:00.000Z,u2,/b,200,100',
      '2025-01-03T10:12:00+00:00,u3,/c,200,100',
    ]);
    expect(rows.length).toBe(3);
  });
});

describe('Q2 aggregate timezone conversion', () => {
  it('converts UTC to JST correctly', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T23:30:00Z,u1,/api/orders,200,100', // UTC 23:30 -> JST 08:30 (次の日)
      '2025-01-04T00:30:00Z,u2,/api/orders,200,200', // UTC 00:30 -> JST 09:30 (同じ日)
    ];

    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-04',
      tz: 'jst',
      top: 5,
    });

    // JST基準では両方とも 2025-01-04 になる
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: '2025-01-04',
      path: '/api/orders',
      count: 2,
      avgLatency: 150, // (100+200)/2
    });
  });

  it('converts UTC to ICT correctly', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T22:00:00Z,u1,/api/orders,200,100', // UTC 22:00 -> ICT 05:00 (翌日)
      '2025-01-04T01:00:00Z,u2,/api/orders,200,200', // UTC 01:00 -> ICT 08:00 (同日)
    ];

    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-04',
      tz: 'ict',
      top: 5,
    });

    // ICT基準では両方とも 2025-01-04 になる
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: '2025-01-04',
      path: '/api/orders',
      count: 2,
      avgLatency: 150,
    });
  });
});

describe('Q2 aggregate ranking and sorting', () => {
  it('applies top N ranking per date', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      // 2025-01-03 のデータ
      '2025-01-03T10:00:00Z,u1,/api/orders,200,100',
      '2025-01-03T10:01:00Z,u2,/api/orders,200,100', // カウント=2
      '2025-01-03T10:02:00Z,u3,/api/users,200,100',
      '2025-01-03T10:03:00Z,u4,/api/users,200,100',
      '2025-01-03T10:04:00Z,u5,/api/users,200,100', // カウント=3 (最多)
      '2025-01-03T10:05:00Z,u6,/api/products,200,100', // カウント=1
      // 2025-01-04 のデータ
      '2025-01-04T10:00:00Z,u7,/api/search,200,100',
      '2025-01-04T10:01:00Z,u8,/api/search,200,100', // カウント=2
      '2025-01-04T10:02:00Z,u9,/api/cart,200,100', // カウント=1
    ];

    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-04',
      tz: 'jst',
      top: 2, // 各日付でトップ 2のみ
    });

    // 各日付でトップ 2のみ残る
    expect(result).toHaveLength(4);

    // 2025-01-03: /api/users(カウント=3), /api/orders(カウント=2) のみ
    // 2025-01-04: /api/search(カウント=2), /api/cart(カウント=1) のみ
    expect(result[0]).toEqual({
      date: '2025-01-03',
      path: '/api/users',
      count: 3,
      avgLatency: 100,
    });
    expect(result[1]).toEqual({
      date: '2025-01-03',
      path: '/api/orders',
      count: 2,
      avgLatency: 100,
    });
    expect(result[2]).toEqual({
      date: '2025-01-04',
      path: '/api/search',
      count: 2,
      avgLatency: 100,
    });
    expect(result[3]).toEqual({
      date: '2025-01-04',
      path: '/api/cart',
      count: 1,
      avgLatency: 100,
    });
  });

  it('sorts with ties using path alphabetical order', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T10:00:00Z,u1,/z-path,200,100', // カウント=1
      '2025-01-03T10:01:00Z,u2,/a-path,200,200', // カウント=1
      '2025-01-03T10:02:00Z,u3,/m-path,200,300', // カウント=1
    ];

    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-03',
      tz: 'jst',
      top: 5,
    });

    // カウント同じなので パス名アルファベット順
    expect(result).toHaveLength(3);
    expect(result[0].path).toBe('/a-path');
    expect(result[1].path).toBe('/m-path');
    expect(result[2].path).toBe('/z-path');
  });

  it('calculates avgLatency with proper rounding', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T10:00:00Z,u1,/api/test,200,100',
      '2025-01-03T10:01:00Z,u2,/api/test,200,101',
      '2025-01-03T10:02:00Z,u3,/api/test,200,102', // 平均 = 101
    ];

    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-03',
      tz: 'jst',
      top: 5,
    });

    expect(result[0].avgLatency).toBe(101); // (100+101+102)/3 = 101
  });
});

describe('Q2 aggregate edge cases', () => {
  it('handles empty result', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2025-01-01T10:00:00Z,u1,/api/test,200,100',
    ];

    const result = aggregate(lines, {
      from: '2025-01-02', // 範囲外
      to: '2025-01-02',
      tz: 'jst',
      top: 5,
    });

    expect(result).toHaveLength(0);
  });

  it('handles large dataset with ties and complex sorting', () => {
    const lines = createLargeTestDataset();

    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-04',
      tz: 'jst',
      top: 2, // 各日付でトップ2のみ
    });

    // 期待結果:
    // 2025-01-03: /popular(カウント=3), /a-api(カウント=1, 同順位中アルファベット順で先頭)
    // 2025-01-04: /beta(カウント=2), /alpha(カウント=1)
    expect(result).toHaveLength(4);

    expect(result[0]).toEqual({
      date: '2025-01-03',
      path: '/popular',
      count: 3,
      avgLatency: 75, // (50+75+100)/3 = 75
    });
    expect(result[1]).toEqual({
      date: '2025-01-03',
      path: '/a-api', // 同順位中アルファベット順で先頭
      count: 1,
      avgLatency: 150,
    });
    expect(result[2]).toEqual({
      date: '2025-01-04',
      path: '/beta',
      count: 2,
      avgLatency: 100, // (80+120)/2 = 100
    });
    expect(result[3]).toEqual({
      date: '2025-01-04',
      path: '/alpha',
      count: 1,
      avgLatency: 90,
    });
  });
});
