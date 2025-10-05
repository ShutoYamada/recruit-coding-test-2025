/* eslint-disable max-lines-per-function */
import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  // ============= 1. Parsing Tests =============
  describe('parseLines', () => {
    it('skips broken rows with missing columns', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/a,200,100',
        'broken,row,only,three',
        'only,two',
        '',
      ]);
      expect(rows.length).toBe(1);
      expect(rows[0].path).toBe('/a');
    });

    it('handles rows with extra whitespace', () => {
      const rows = parseLines([
        ' 2025-01-03T10:12:00Z , u1 , /api/test , 200 , 150 ',
      ]);
      expect(rows.length).toBe(1);
      expect(rows[0].timestamp).toBe('2025-01-03T10:12:00Z');
      expect(rows[0].userId).toBe('u1');
      expect(rows[0].path).toBe('/api/test');
    });

    it('parses numeric fields correctly', () => {
      const rows = parseLines(['2025-01-03T10:12:00Z,u1,/a,404,250']);
      expect(rows[0].status).toBe(404);
      expect(rows[0].latencyMs).toBe(250);
    });
  });

  // ============= 2. Date Range Filter Tests =============
  describe('Date Range Filtering', () => {
    it('includes rows on from boundary (start of day)', () => {
      const lines = ['2025-01-03T00:00:00Z,u1,/api/test,200,100'];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });
      expect(res.length).toBe(1);
    });

    it('includes rows on to boundary (end of day)', () => {
      const lines = ['2025-01-05T23:59:59Z,u1,/api/test,200,100'];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });
      expect(res.length).toBe(1);
    });

    it('excludes rows before from date', () => {
      const lines = [
        '2025-01-02T23:59:59Z,u1,/api/test,200,100',
        '2025-01-03T00:00:00Z,u2,/api/test,200,100',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });
      expect(res.length).toBe(1);
      expect(res[0].count).toBe(1);
    });

    it('excludes rows after to date', () => {
      const lines = [
        '2025-01-05T23:59:59Z,u1,/api/test,200,100',
        '2025-01-06T00:00:00Z,u2,/api/test,200,100',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });
      expect(res.length).toBe(1);
      expect(res[0].count).toBe(1);
    });
  });

  // ============= 3. Timezone Conversion Tests =============
  describe('Timezone Conversion', () => {
    it('converts UTC to JST correctly (date boundary)', () => {
      // 2025-01-03T23:00:00Z = 2025-01-04T08:00:00 JST
      const lines = ['2025-01-03T23:00:00Z,u1,/api/test,200,100'];
      const res = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-10',
        tz: 'jst',
        top: 5,
      });
      expect(res[0].date).toBe('2025-01-04'); // Should be next day in JST
    });

    it('converts UTC to ICT correctly', () => {
      // 2025-01-03T20:00:00Z = 2025-01-04T03:00:00 ICT (UTC+7)
      const lines = ['2025-01-03T20:00:00Z,u1,/api/test,200,100'];
      const res = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-10',
        tz: 'ict',
        top: 5,
      });
      expect(res[0].date).toBe('2025-01-04');
    });

    it('keeps same day when no boundary crossing (JST)', () => {
      // 2025-01-03T10:00:00Z = 2025-01-03T19:00:00 JST
      const lines = ['2025-01-03T10:00:00Z,u1,/api/test,200,100'];
      const res = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-10',
        tz: 'jst',
        top: 5,
      });
      expect(res[0].date).toBe('2025-01-03');
    });
  });

  // ============= 4. Aggregation Tests =============
  describe('Aggregation (date × path)', () => {
    it('calculates count and avgLatency correctly', () => {
      const lines = [
        '2025-01-03T10:12:00Z,u1,/api/orders,200,120',
        '2025-01-03T10:13:00Z,u2,/api/orders,200,180',
        '2025-01-03T11:00:00Z,u3,/api/users,200,90',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-04',
        tz: 'jst',
        top: 5,
      });

      const orders = res.find((r) => r.path === '/api/orders');
      expect(orders?.count).toBe(2);
      expect(orders?.avgLatency).toBe(150); // (120+180)/2 = 150

      const users = res.find((r) => r.path === '/api/users');
      expect(users?.count).toBe(1);
      expect(users?.avgLatency).toBe(90);
    });

    it('rounds avgLatency to nearest integer', () => {
      const lines = [
        '2025-01-03T10:00:00Z,u1,/api/test,200,100',
        '2025-01-03T10:01:00Z,u2,/api/test,200,101',
        '2025-01-03T10:02:00Z,u3,/api/test,200,102',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-04',
        tz: 'jst',
        top: 5,
      });
      // (100+101+102)/3 = 101
      expect(res[0].avgLatency).toBe(101);
    });

    it('separates same path on different dates', () => {
      const lines = [
        '2025-01-03T10:00:00Z,u1,/api/test,200,100',
        '2025-01-04T10:00:00Z,u2,/api/test,200,200',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });
      expect(res.length).toBe(2);
      expect(res[0].date).toBe('2025-01-03');
      expect(res[1].date).toBe('2025-01-04');
    });
  });

  // ============= 5. Top N Ranking Tests =============
  describe('Top N Ranking (per day)', () => {
    it('selects top N by count per day', () => {
      const lines = [
        // Day 1: 3 paths
        '2025-01-03T10:00:00Z,u1,/api/a,200,100',
        '2025-01-03T10:01:00Z,u1,/api/a,200,100',
        '2025-01-03T10:02:00Z,u1,/api/a,200,100', // count=3
        '2025-01-03T10:03:00Z,u1,/api/b,200,100',
        '2025-01-03T10:04:00Z,u1,/api/b,200,100', // count=2
        '2025-01-03T10:05:00Z,u1,/api/c,200,100', // count=1
        '2025-01-03T10:06:00Z,u1,/api/d,200,100', // count=1
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-04',
        tz: 'jst',
        top: 2, // Only top 2
      });

      expect(res.length).toBe(2);
      expect(res[0].path).toBe('/api/a');
      expect(res[0].count).toBe(3);
      expect(res[1].path).toBe('/api/b');
      expect(res[1].count).toBe(2);
    });

    it('handles tie-breaking by path ascending', () => {
      const lines = [
        '2025-01-03T10:00:00Z,u1,/api/zebra,200,100',
        '2025-01-03T10:01:00Z,u1,/api/alpha,200,100',
        '2025-01-03T10:02:00Z,u1,/api/beta,200,100',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-04',
        tz: 'jst',
        top: 2,
      });

      // All have count=1, so sort by path
      expect(res.length).toBe(2);
      expect(res[0].path).toBe('/api/alpha');
      expect(res[1].path).toBe('/api/beta');
      // /api/zebra should be excluded
    });

    it('applies top N independently per day', () => {
      const lines = [
        // Day 1: 3 paths
        '2025-01-03T10:00:00Z,u1,/api/a,200,100',
        '2025-01-03T10:01:00Z,u1,/api/b,200,100',
        '2025-01-03T10:02:00Z,u1,/api/c,200,100',
        // Day 2: 3 paths
        '2025-01-04T10:00:00Z,u1,/api/x,200,100',
        '2025-01-04T10:01:00Z,u1,/api/y,200,100',
        '2025-01-04T10:02:00Z,u1,/api/z,200,100',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 2,
      });

      // Should have 2 from each day = 4 total
      expect(res.length).toBe(4);
      expect(res.filter((r) => r.date === '2025-01-03').length).toBe(2);
      expect(res.filter((r) => r.date === '2025-01-04').length).toBe(2);
    });
  });

  // ============= 6. Output Ordering Tests =============
  describe('Final Output Ordering', () => {
    it('sorts by date ASC, count DESC, path ASC', () => {
      const lines = [
        // Day 2 first (to test date sorting)
        '2025-01-04T10:00:00Z,u1,/api/z,200,100',
        '2025-01-04T10:01:00Z,u1,/api/z,200,100', // count=2
        '2025-01-04T10:02:00Z,u1,/api/a,200,100', // count=1
        // Day 1
        '2025-01-03T10:00:00Z,u1,/api/x,200,100',
        '2025-01-03T10:01:00Z,u1,/api/x,200,100',
        '2025-01-03T10:02:00Z,u1,/api/x,200,100', // count=3
        '2025-01-03T10:03:00Z,u1,/api/y,200,100', // count=1
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });

      // Expected order:
      // 2025-01-03, /api/x, count=3
      // 2025-01-03, /api/y, count=1
      // 2025-01-04, /api/z, count=2
      // 2025-01-04, /api/a, count=1
      expect(res[0]).toEqual({
        date: '2025-01-03',
        path: '/api/x',
        count: 3,
        avgLatency: 100,
      });
      expect(res[1]).toEqual({
        date: '2025-01-03',
        path: '/api/y',
        count: 1,
        avgLatency: 100,
      });
      expect(res[2]).toEqual({
        date: '2025-01-04',
        path: '/api/z',
        count: 2,
        avgLatency: 100,
      });
      expect(res[3]).toEqual({
        date: '2025-01-04',
        path: '/api/a',
        count: 1,
        avgLatency: 100,
      });
    });
  });

  // ============= 7. Comprehensive Integration Tests =============
  describe('Integration Tests', () => {
    it('matches README example', () => {
      const lines = [
        '2025-01-03T10:12:00Z,u1,/api/orders,200,120',
        '2025-01-03T10:13:00Z,u2,/api/orders,200,180',
        '2025-01-03T11:00:00Z,u3,/api/users,200,90',
        '2025-01-04T00:10:00Z,u1,/api/orders,200,110',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-04',
        tz: 'jst',
        top: 3,
      });
      expect(res).toEqual([
        { date: '2025-01-03', path: '/api/orders', count: 2, avgLatency: 150 },
        { date: '2025-01-03', path: '/api/users', count: 1, avgLatency: 90 },
        { date: '2025-01-04', path: '/api/orders', count: 1, avgLatency: 110 },
      ]);
    });

    it('handles large dataset with multiple dates and paths', () => {
      const lines = [];
      // Generate requests across 3 days with varying counts per path
      // Each day will have distinct hours to avoid timezone boundary issues
      for (let day = 3; day <= 5; day++) {
        for (let path = 1; path <= 5; path++) {
          // path1 gets 5 requests, path2 gets 4, path3 gets 3, path4 gets 2, path5 gets 1
          const requestCount = 6 - path;
          for (let i = 0; i < requestCount; i++) {
            // Use hour range 08:00-13:00 UTC to ensure same day in JST (17:00-22:00)
            lines.push(
              `2025-01-0${day}T${String(8 + i).padStart(2, '0')}:00:00Z,u${i},/api/path${path},200,${100 + path * 10}`
            );
          }
        }
      }

      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 3,
      });

      // Should have 3 results per day = 9 total
      expect(res.length).toBe(9);
      // Each date should have exactly 3 entries
      expect(res.filter((r) => r.date === '2025-01-03').length).toBe(3);
      expect(res.filter((r) => r.date === '2025-01-04').length).toBe(3);
      expect(res.filter((r) => r.date === '2025-01-05').length).toBe(3);

      // Top 3 paths should be path1, path2, path3 (highest counts)
      const day1 = res.filter((r) => r.date === '2025-01-03');
      expect(day1[0].path).toBe('/api/path1');
      expect(day1[0].count).toBe(5);
      expect(day1[1].path).toBe('/api/path2');
      expect(day1[1].count).toBe(4);
      expect(day1[2].path).toBe('/api/path3');
      expect(day1[2].count).toBe(3);
    });
  });
});
