import { describe, expect, it } from 'vitest';
import { parseLines, aggregate } from './core.js';

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
