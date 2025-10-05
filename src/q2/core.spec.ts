import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  // 1. パース：壊れた行をスキップ
  describe('parseLines', () => {
    it('skips broken rows with insufficient columns', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/a,200,100',
        'broken,row,only,three',
      ]);
      expect(rows.length).toBe(1);
      expect(rows[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/a',
        status: 200,
        latencyMs: 100,
      });
    });

    it('skips rows with empty fields', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/a,200,100',
        ',u2,/b,200,50', // empty timestamp
        '2025-01-03T11:00:00Z,,/c,200,75', // empty userId
      ]);
      expect(rows.length).toBe(1);
    });

    it('trims whitespace from fields', () => {
      const rows = parseLines([
        ' 2025-01-03T10:12:00Z , u1 , /api/test , 200 , 100 ',
      ]);
      expect(rows[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/api/test',
        status: 200,
        latencyMs: 100,
      });
    });

    it('parses numeric fields correctly', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/a,404,250',
      ]);
      expect(rows[0].status).toBe(404);
      expect(rows[0].latencyMs).toBe(250);
      expect(typeof rows[0].status).toBe('number');
      expect(typeof rows[0].latencyMs).toBe('number');
    });
  });

  // 2. 期間フィルタ：from/to の境界含む / 範囲外除外
  describe('filterByDate - boundary tests', () => {
    it('includes both from and to boundaries (UTC)', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100', // exactly from
        '2025-01-01T12:00:00Z,u2,/b,200,150',
        '2025-01-03T23:59:59Z,u3,/c,200,200', // exactly to
        '2025-01-04T00:00:00Z,u4,/d,200,250', // after to
        '2024-12-31T23:59:59Z,u5,/e,200,300', // before from
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-03',
        tz: 'jst',
        top: 10,
      });

      // Should include 3 records (from boundary, middle, to boundary)
      expect(result.length).toBe(3);
      expect(result.find(r => r.path === '/a')).toBeDefined();
      expect(result.find(r => r.path === '/c')).toBeDefined();
      expect(result.find(r => r.path === '/d')).toBeUndefined(); // after to
      expect(result.find(r => r.path === '/e')).toBeUndefined(); // before from
    });

    it('excludes records outside date range', () => {
      const lines = [
        '2024-12-31T23:59:59Z,u1,/a,200,100',
        '2025-01-01T00:00:00Z,u2,/b,200,150',
        '2025-01-02T12:00:00Z,u3,/c,200,200',
        '2025-01-03T23:59:59Z,u4,/d,200,250',
        '2025-01-04T00:00:00Z,u5,/e,200,300',
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-03',
        tz: 'jst',
        top: 10,
      });

      expect(result.every(r => r.path !== '/a')).toBe(true); // before range
      expect(result.every(r => r.path !== '/e')).toBe(true); // after range
    });
  });


  // 3. タイムゾーン：UTC→JST/ICT の変換で日付跨ぎが正しい
  describe('timezone conversion', () => {
    it('converts UTC to JST correctly with date boundary crossing', () => {
      const lines = [
        '2025-01-01T14:00:00Z,u1,/a,200,100', // 23:00 JST (same day)
        '2025-01-01T15:00:00Z,u2,/a,200,150', // 00:00 JST next day
        '2025-01-01T16:00:00Z,u3,/a,200,200', // 01:00 JST next day
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-02',
        tz: 'jst',
        top: 10,
      });

      const jan01 = result.find(r => r.date === '2025-01-01');
      const jan02 = result.find(r => r.date === '2025-01-02');

      expect(jan01).toBeDefined();
      expect(jan01?.count).toBe(1); // only 14:00 UTC
      expect(jan02).toBeDefined();
      expect(jan02?.count).toBe(2); // 15:00 and 16:00 UTC
    });

    it('converts UTC to ICT correctly with date boundary crossing', () => {
      const lines = [
        '2025-01-01T16:00:00Z,u1,/b,200,100', // 23:00 ICT (same day)
        '2025-01-01T17:00:00Z,u2,/b,200,150', // 00:00 ICT next day
        '2025-01-01T18:00:00Z,u3,/b,200,200', // 01:00 ICT next day
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-02',
        tz: 'ict',
        top: 10,
      });

      const jan01 = result.find(r => r.date === '2025-01-01');
      const jan02 = result.find(r => r.date === '2025-01-02');

      expect(jan01).toBeDefined();
      expect(jan01?.count).toBe(1);
      expect(jan02).toBeDefined();
      expect(jan02?.count).toBe(2);
    });
  });

  // 4. 集計：date×path の件数・平均が合う
  describe('aggregation', () => {
    it('calculates count and average latency correctly', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/api/orders,200,100',
        '2025-01-01T01:00:00Z,u2,/api/orders,200,200',
        '2025-01-01T02:00:00Z,u3,/api/orders,200,150',
        '2025-01-01T03:00:00Z,u4,/api/users,200,300',
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 10,
      });

      const orders = result.find(r => r.path === '/api/orders');
      const users = result.find(r => r.path === '/api/users');

      expect(orders?.count).toBe(3);
      expect(orders?.avgLatency).toBe(150); // (100+200+150)/3 = 150
      expect(users?.count).toBe(1);
      expect(users?.avgLatency).toBe(300);
    });

    it('rounds average latency correctly', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-01T01:00:00Z,u2,/a,200,101',
        '2025-01-01T02:00:00Z,u3,/a,200,102',
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 10,
      });

      // (100+101+102)/3 = 303/3 = 101
      expect(result[0].avgLatency).toBe(101);
    });

    it('aggregates separately by date and path', () => {
      const lines = [
        '2025-01-01T10:00:00Z,u1,/a,200,100',
        '2025-01-01T11:00:00Z,u2,/b,200,200',
        '2025-01-02T10:00:00Z,u3,/a,200,150',
        '2025-01-02T11:00:00Z,u4,/b,200,250',
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-02',
        tz: 'jst',
        top: 10,
      });

      expect(result.length).toBe(4); // 2 dates × 2 paths
      expect(result.find(r => r.date === '2025-01-01' && r.path === '/a')?.count).toBe(1);
      expect(result.find(r => r.date === '2025-01-02' && r.path === '/a')?.count).toBe(1);
    });
  });

  // 5. 上位N：日付ごとに count 降順、同数は path 昇順
  describe('top N ranking per date', () => {
    it('selects top N per date by count descending', () => {
      const lines = [
        // 2025-01-01: /a(5), /b(3), /c(2), /d(1)
        ...Array(5).fill(0).map((_, i) => `2025-01-01T0${i}:00:00Z,u${i},/a,200,100`),
        ...Array(3).fill(0).map((_, i) => `2025-01-01T0${i+5}:00:00Z,u${i+5},/b,200,100`),
        ...Array(2).fill(0).map((_, i) => `2025-01-01T0${i+8}:00:00Z,u${i+8},/c,200,100`),
        '2025-01-01T10:00:00Z,u10,/d,200,100',
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 2,
      });

      expect(result.length).toBe(2); // only top 2
      expect(result[0].path).toBe('/a'); // highest count (5)
      expect(result[1].path).toBe('/b'); // second highest (3)
    });

    it('breaks ties by path ascending', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/z,200,100',
        '2025-01-01T01:00:00Z,u2,/z,200,100', // /z: count=2
        '2025-01-01T02:00:00Z,u3,/a,200,100',
        '2025-01-01T03:00:00Z,u4,/a,200,100', // /a: count=2
        '2025-01-01T04:00:00Z,u5,/m,200,100',
        '2025-01-01T05:00:00Z,u6,/m,200,100', // /m: count=2
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 2,
      });

      expect(result.length).toBe(2);
      expect(result[0].path).toBe('/a'); // alphabetically first
      expect(result[1].path).toBe('/m'); // alphabetically second
    });

    it('applies top N independently per date', () => {
      const lines = [
        // Jan 1: /a(3), /b(2), /c(1)
        ...Array(3).fill(0).map((_, i) => `2025-01-01T0${i}:00:00Z,u${i},/a,200,100`),
        ...Array(2).fill(0).map((_, i) => `2025-01-01T0${i+3}:00:00Z,u${i+3},/b,200,100`),
        '2025-01-01T05:00:00Z,u5,/c,200,100',
        // Jan 2: /x(4), /y(2), /z(1)
        ...Array(4).fill(0).map((_, i) => `2025-01-02T0${i}:00:00Z,u${i+10},/x,200,100`),
        ...Array(2).fill(0).map((_, i) => `2025-01-02T0${i+4}:00:00Z,u${i+14},/y,200,100`),
        '2025-01-02T06:00:00Z,u16,/z,200,100',
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-02',
        tz: 'jst',
        top: 2,
      });

      expect(result.length).toBe(4); // 2 per date

      const jan01 = result.filter(r => r.date === '2025-01-01');
      expect(jan01.length).toBe(2);
      expect(jan01.map(r => r.path).sort()).toEqual(['/a', '/b']);

      const jan02 = result.filter(r => r.date === '2025-01-02');
      expect(jan02.length).toBe(2);
      expect(jan02.map(r => r.path).sort()).toEqual(['/x', '/y']);
    });
  });


  // 6. 出力順：date ASC, count DESC, path ASC の決定的順序
  describe('output ordering', () => {
    it('sorts by date ASC, count DESC, path ASC', () => {
      const lines = [
        // Jan 2
        '2025-01-02T00:00:00Z,u1,/z,200,100',
        '2025-01-02T01:00:00Z,u2,/a,200,100',
        '2025-01-02T02:00:00Z,u3,/a,200,100', // /a: count=2
        // Jan 1
        '2025-01-01T00:00:00Z,u4,/b,200,100',
        '2025-01-01T01:00:00Z,u5,/b,200,100',
        '2025-01-01T02:00:00Z,u6,/b,200,100', // /b: count=3
        '2025-01-01T03:00:00Z,u7,/a,200,100', // /a: count=1
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-02',
        tz: 'jst',
        top: 10,
      });

      // Expected order:
      // 2025-01-01, /b, count=3
      // 2025-01-01, /a, count=1
      // 2025-01-02, /a, count=2
      // 2025-01-02, /z, count=1
      expect(result[0]).toMatchObject({ date: '2025-01-01', path: '/b', count: 3 });
      expect(result[1]).toMatchObject({ date: '2025-01-01', path: '/a', count: 1 });
      expect(result[2]).toMatchObject({ date: '2025-01-02', path: '/a', count: 2 });
      expect(result[3]).toMatchObject({ date: '2025-01-02', path: '/z', count: 1 });
    });

    it('maintains stable sort with multiple same-count paths', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/c,200,100',
        '2025-01-01T01:00:00Z,u2,/a,200,100',
        '2025-01-01T02:00:00Z,u3,/b,200,100',
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 10,
      });

      // All have count=1, should be sorted by path
      expect(result[0].path).toBe('/a');
      expect(result[1].path).toBe('/b');
      expect(result[2].path).toBe('/c');
    });
  });

});
