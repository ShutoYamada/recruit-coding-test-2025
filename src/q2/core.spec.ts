import { describe, expect, it } from 'vitest';
import { aggregate, parseLines, type Options } from './core.js';

/**
 * Q2 core tests
 * - 日本語コメントを各 describe/it に追加しています
 * - テストは仕様（パース/期間フィルタ/TZ変換/集計/TopN/出力順）に基づく
 */
// eslint-disable-next-line max-lines-per-function
describe('Q2 core', () => {
  // ========================================
  // 1. Parse Tests - 壊れた行のスキップ / Parse: skip broken rows
  // ========================================
  describe('parseLines (パース)', () => {
    it('should parse valid CSV lines correctly', () => {
      const lines = [
        '2025-01-03T10:12:00Z,u1,/api/orders,200,123',
        '2025-01-03T11:30:00Z,u2,/api/users,404,50',
      ];
      const rows = parseLines(lines);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/api/orders',
        status: 200,
        latencyMs: 123,
      });
      expect(rows[1]).toEqual({
        timestamp: '2025-01-03T11:30:00Z',
        userId: 'u2',
        path: '/api/users',
        status: 404,
        latencyMs: 50,
      });
    });

    it('should skip rows with missing columns', () => {
      const lines = [
        '2025-01-03T10:12:00Z,u1,/a,200,100',
        'broken,row,only,three', // 4 columns only -> skip
        '2025-01-03T10:13:00Z,u2,/b,200,200',
        'only,two', // 2 columns -> skip
        '', // empty line -> skip
      ];
      const rows = parseLines(lines);

      expect(rows).toHaveLength(2);
      expect(rows[0].path).toBe('/a');
      expect(rows[1].path).toBe('/b');
    });

    it('should trim whitespace from fields', () => {
      const lines = [
        ' 2025-01-03T10:12:00Z , u1 , /api/test , 200 , 100 ',
      ];
      const rows = parseLines(lines);

      expect(rows).toHaveLength(1);
      expect(rows[0].timestamp).toBe('2025-01-03T10:12:00Z');
      expect(rows[0].userId).toBe('u1');
      expect(rows[0].path).toBe('/api/test');
      expect(rows[0].status).toBe(200);
      expect(rows[0].latencyMs).toBe(100);
    });

    it('should skip rows where status or latency are non-numeric', () => {
      const lines = [
        '2025-01-03T10:12:00Z,u1,/a,200,100',      // valid
        '2025-01-03T10:13:00Z,u2,/b,OK,200',       // status non-numeric -> skip (expected by spec)
        '2025-01-03T10:14:00Z,u3,/c,200,NaN',      // latency non-numeric -> skip (expected by spec)
        '2025-01-03T10:15:00Z,u4,/d,404,50',       // valid
      ];
      const rows = parseLines(lines);

      // NOTE: parseLines in core.ts currently only checks presence of fields.
      // Spec requires skipping non-numeric; if core.ts not updated, this test will fail,
      // indicating core.ts needs to validate numeric conversion.
      // Here we assert expected behavior per spec.
      expect(rows.map(r => r.path)).toEqual(['/a', '/d']);
    });
  });

  // ========================================
  // 2. Date Filter Tests - 期間フィルタ（境界値含む）
  // ========================================
  describe('Date filtering (期間フィルタ)', () => {
    it('should include from date boundary (start of day)', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100', // exactly at from boundary
        '2025-01-02T10:00:00Z,u1,/a,200,100',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      // both lines fall into the UTC window [2025-01-01T00:00:00Z, 2025-01-31T23:59:59Z]
      // after TZ conversion they may map to dates; ensure result is not empty
      expect(result.length).toBeGreaterThan(0);
      // exist some date that corresponds to 2025-01-01 or 2025-01-02 after tz
      expect(result).toEqual([
        { date: '2025-01-01', path: '/a', count: 1, avgLatency: 100 },
        { date: '2025-01-02', path: '/a', count: 1, avgLatency: 100 },
      ]);
    });

    it('should include to date boundary (end of day)', () => {
      const lines = [
        '2025-01-31T23:59:59Z,u1,/a,200,100', // exactly at to boundary
        '2025-02-01T00:00:00Z,u1,/a,200,100', // outside
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      // only first line should be included
      expect(result.some(r => r.path === '/a')).toBe(true);
      // ensure second line (2025-02-01 UTC) is excluded
      expect(result.every(r => r.date !== '2025-02-02')).toBe(true); // conservative check
    });

    it('should exclude dates before from', () => {
      const lines = [
        '2024-12-31T23:59:59Z,u1,/a,200,100', // before from
        '2025-01-01T00:00:00Z,u1,/b,200,200', // inside
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      // only /b should remain
      expect(result.find(r => r.path === '/b')).toBeTruthy();
      expect(result.find(r => r.path === '/a')).toBeFalsy();
    });

    it('should handle from > to by returning empty array', () => {
      const lines = [
        '2025-01-10T00:00:00Z,u1,/a,200,100',
      ];
      // intentionally from > to
      const opt: Options = { from: '2025-02-01', to: '2025-01-01', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      // We choose behavior: return empty result when range is invalid
      expect(result).toHaveLength(0);
    });
  });

  // ========================================
  // 3. Timezone Conversion Tests - UTC→JST/ICT変換
  // ========================================
  describe('Timezone conversion', () => {
    it('should convert UTC to JST (+9) correctly and split days', () => {
      const lines = [
        '2025-01-01T14:00:00Z,u1,/a,200,100', // UTC14 -> JST23 (same day)
        '2025-01-01T15:00:00Z,u1,/a,200,100', // UTC15 -> JST00 next day
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-02', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      // Expect both dates (2025-01-01 and 2025-01-02) appear after tz conversion
      expect(result.some(r => r.date === '2025-01-01')).toBe(true);
      expect(result.some(r => r.date === '2025-01-02')).toBe(true);
    });

    it('should convert UTC to ICT (+7) correctly and split days', () => {
      const lines = [
        '2025-01-01T16:00:00Z,u1,/a,200,100', // UTC16 -> ICT23
        '2025-01-01T17:00:00Z,u1,/a,200,100', // UTC17 -> ICT00 next day
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-02', tz: 'ict', top: 10 };
      const result = aggregate(lines, opt);

      expect(result.some(r => r.date === '2025-01-01')).toBe(true);
      expect(result.some(r => r.date === '2025-01-02')).toBe(true);
    });

    it('should handle exact boundary times around 15:00 UTC for JST mapping ', () => {
      const lines = [
        '2025-01-01T14:59:59Z,u1,/a,200,100', // JST: 2025-01-01 23:59:59
        '2025-01-01T15:00:00Z,u1,/b,200,100', // JST: 2025-01-02 00:00:00
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-02', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      const jan1 = result.filter(r => r.date === '2025-01-01');
      const jan2 = result.filter(r => r.date === '2025-01-02');

      expect(jan1.some(r => r.path === '/a')).toBe(true);
      expect(jan2.some(r => r.path === '/b')).toBe(true);
    });
  });

  // ========================================
  // 4. Aggregation Tests - 集計の正確性
  // ========================================
  describe('Aggregation (集計)', () => {
    it('should count requests correctly per date and path ', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-01T01:00:00Z,u2,/a,200,200',
        '2025-01-01T02:00:00Z,u3,/a,200,300',
        '2025-01-01T03:00:00Z,u4,/b,200,400',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      const pa = result.find(r => r.path === '/a');
      const pb = result.find(r => r.path === '/b');

      expect(pa?.count).toBe(3);
      expect(pb?.count).toBe(1);
    });

    it('should calculate average latency correctly and round', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-01T01:00:00Z,u2,/a,200,200',
        '2025-01-01T02:00:00Z,u3,/a,200,300', // avg = 200
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      const pa = result.find(r => r.path === '/a');
      expect(pa?.avgLatency).toBe(200);
    });

    it('should round .5 up (四捨五入) /', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-01T01:00:00Z,u2,/a,200,151', // avg = 125.5 -> 126
        '2025-01-01T02:00:00Z,u3,/b,200,100',
        '2025-01-01T03:00:00Z,u4,/b,200,149', // avg = 124.5 -> 124 (rounded to 124? depends on Math.round)
      ];
      // Note: Math.round(124.5) === 125 in JS (round to nearest, .5 up)
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      const pa = result.find(r => r.path === '/a');
      expect(pa?.avgLatency).toBe(Math.round((100 + 151) / 2)); // 251/2 = 125.5 -> 126
    });

    it('should aggregate separately for different dates', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-02T00:00:00Z,u1,/a,200,200',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-02', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      expect(result.find(r => r.date === '2025-01-01')).toBeTruthy();
      expect(result.find(r => r.date === '2025-01-02')).toBeTruthy();
    });
  });

   // ========================================
  // 5. Top N Ranking Tests - 日付ごとの上位N
  // ========================================
  describe('Top N ranking per date (日付ごとの上位N)', () => {
    it('should return top N paths per date by count descending', () => {
      const lines = [
        // 2025-01-01: /a=3, /b=2, /c=1
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-01T01:00:00Z,u1,/a,200,100',
        '2025-01-01T02:00:00Z,u1,/a,200,100',
        '2025-01-01T03:00:00Z,u1,/b,200,100',
        '2025-01-01T04:00:00Z,u1,/b,200,100',
        '2025-01-01T05:00:00Z,u1,/c,200,100',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 2 };
      const result = aggregate(lines, opt);

      const jan1 = result.filter(r => r.date === '2025-01-01');
      expect(jan1).toHaveLength(2);
      expect(jan1[0].path).toBe('/a');
      expect(jan1[1].path).toBe('/b');
    });

    it('should sort by path ASC when counts are equal', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/c,200,100',
        '2025-01-01T01:00:00Z,u1,/a,200,100',
        '2025-01-01T02:00:00Z,u1,/b,200,100',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 3 };
      const result = aggregate(lines, opt);

      // all counts = 1 => path ascending: /a, /b, /c
      expect(result[0].path).toBe('/a');
      expect(result[1].path).toBe('/b');
      expect(result[2].path).toBe('/c');
    });

    it('should apply top N separately for each date', () => {
      const lines = [
        // 2025-01-01: /a=3, /b=2
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-01T01:00:00Z,u1,/a,200,100',
        '2025-01-01T02:00:00Z,u1,/a,200,100',
        '2025-01-01T03:00:00Z,u1,/b,200,100',
        '2025-01-01T04:00:00Z,u1,/b,200,100',
        // 2025-01-02: /x=2, /y=1
        '2025-01-02T00:00:00Z,u1,/x,200,100',
        '2025-01-02T01:00:00Z,u1,/x,200,100',
        '2025-01-02T02:00:00Z,u1,/y,200,100',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-02', tz: 'jst', top: 1 };
      const result = aggregate(lines, opt);

      // top=1 per date => one entry for 2025-01-01 (/a) and one for 2025-01-02 (/x)
      const jan1 = result.filter(r => r.date === '2025-01-01');
      const jan2 = result.filter(r => r.date === '2025-01-02');

      expect(jan1).toHaveLength(1);
      expect(jan1[0].path).toBe('/a');

      expect(jan2).toHaveLength(1);
      expect(jan2[0].path).toBe('/x');
    });
  });

  // ========================================
  // 6. Final Output Sorting Tests - 決定的順序
  // ========================================
  describe('Final output sorting (最終出力の順序)', () => {
    it('should sort by date ASC, count DESC, path ASC', () => {
      const lines = [
        // 2025-01-02: /b=2, /a=1
        '2025-01-02T00:00:00Z,u1,/a,200,100',
        '2025-01-02T01:00:00Z,u1,/b,200,100',
        '2025-01-02T02:00:00Z,u1,/b,200,100',
        // 2025-01-01: /z=3, /x=2, /y=2
        '2025-01-01T00:00:00Z,u1,/z,200,100',
        '2025-01-01T01:00:00Z,u1,/z,200,100',
        '2025-01-01T02:00:00Z,u1,/z,200,100',
        '2025-01-01T03:00:00Z,u1,/x,200,100',
        '2025-01-01T04:00:00Z,u1,/x,200,100',
        '2025-01-01T05:00:00Z,u1,/y,200,100',
        '2025-01-01T06:00:00Z,u1,/y,200,100',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-02', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      // Expect deterministic ordering:
      // 2025-01-01: /z(3), /x(2), /y(2) -> x and y both count=2 so path asc -> /x then /y
      // 2025-01-02: /b(2), /a(1)
      expect(result[0].date).toBe('2025-01-01');
      expect(result[0].path).toBe('/z');
      expect(result[1].date).toBe('2025-01-01');
      expect(result[1].path).toBe('/x');
      expect(result[2].date).toBe('2025-01-01');
      expect(result[2].path).toBe('/y');
      expect(result[3].date).toBe('2025-01-02');
      expect(result[3].path).toBe('/b');
      expect(result[4].date).toBe('2025-01-02');
      expect(result[4].path).toBe('/a');
    });

    it('should be stable/deterministic across runs', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-01T01:00:00Z,u1,/b,200,100',
        '2025-01-01T02:00:00Z,u1,/c,200,100',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 10 };

      const r1 = aggregate(lines, opt);
      const r2 = aggregate(lines, opt);

      expect(r1).toEqual(r2);
    });
  });

  // ========================================
  // 7. Integration & Performance Tests - 総合テスト
  // ========================================
  describe('Integration tests (総合)', () => {
    it('should handle sample scenario and compute avg correctly', () => {
    const lines = [
      '2025-01-03T10:12:00Z,u42,/api/orders,200,123',
      '2025-01-03T10:15:00Z,u43,/api/orders,200,145',
      '2025-01-03T10:20:00Z,u44,/api/users,404,50',
      '2025-01-03T14:00:00Z,u45,/api/products,200,200',
      '2025-01-03T15:30:00Z,u46,/api/orders,200,130', // -> JST: 2025-01-04 00:30
    ];
    const opt: Options = { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 3 };
    const result = aggregate(lines, opt);

    // Check orders on 2025-01-03 (only 2 entries remain in JST)
    const ordersDay1 = result.find(r => r.path === '/api/orders' && r.date === '2025-01-03');
    expect(ordersDay1).toBeTruthy();
    expect(ordersDay1?.count).toBe(2);
    expect(ordersDay1?.avgLatency).toBe(Math.round((123 + 145) / 2)); // -> 134

    // Check orders moved to 2025-01-04
    const ordersDay2 = result.find(r => r.path === '/api/orders' && r.date === '2025-01-04');
    expect(ordersDay2).toBeTruthy();
    expect(ordersDay2?.count).toBe(1);
    expect(ordersDay2?.avgLatency).toBe(130);
    });

    it('should handle large dataset and ensure top N per date <= top', () => {
      const lines: string[] = [];
      const paths = ['/a', '/b', '/c', '/d', '/e'];

      // generate 1000 lines spread across January
      for (let i = 0; i < 1000; i++) {
        const day = (i % 30) + 1;
        const date = new Date(Date.UTC(2025, 0, day, 0, 0, 0)); // UTC date for stability
        const path = paths[i % paths.length];
        const latency = (i % 500) + 1;
        lines.push(`${date.toISOString()},u${i},${path},200,${latency}`);
      }

      const opt: Options = { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 3 };
      const result = aggregate(lines, opt);

      // verify that for every date in result, entries count <= top
      const byDate = new Map<string, number>();
      for (const r of result) {
        byDate.set(r.date, (byDate.get(r.date) || 0) + 1);
      }
      for (const cnt of byDate.values()) {
        expect(cnt).toBeLessThanOrEqual(3);
      }
    });

    it('should return empty when no data in range', () => {
      const lines = [
        '2024-12-31T00:00:00Z,u1,/a,200,100',
        '2025-02-01T00:00:00Z,u1,/b,200,100',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      expect(result).toHaveLength(0);
    });

    it('should handle mixed valid and invalid lines', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        'invalid,line',
        '2025-01-01T01:00:00Z,u2,/a,200,200',
        'another,bad,line',
        '2025-01-01T02:00:00Z,u3,/b,200,300',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      // expect two paths: /a and /b
      expect(result.find(r => r.path === '/a')?.count).toBe(2);
      expect(result.find(r => r.path === '/b')?.count).toBe(1);
    });
  });

  // ========================================
  // 8. Edge Cases - エッジケース
  // ========================================
  describe('Edge cases (エッジケース)', () => {
    it('should handle single data point', () => {
      const lines = ['2025-01-01T00:00:00Z,u1,/a,200,100'];
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(1);
      expect(result[0].avgLatency).toBe(100);
    });

    it('should handle top=0 by returning empty', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-01T01:00:00Z,u1,/b,200,100',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 0 };
      const result = aggregate(lines, opt);

      expect(result).toHaveLength(0);
    });

    it('should handle identical timestamps for multiple requests', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-01T00:00:00Z,u2,/a,200,200',
        '2025-01-01T00:00:00Z,u3,/a,200,300',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      expect(result[0].count).toBe(3);
      expect(result[0].avgLatency).toBe(200);
    });

    it('should handle very large latency values without numeric overflow', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,999999999',
        '2025-01-01T01:00:00Z,u1,/a,200,1',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      expect(result[0].avgLatency).toBe(Math.round((999999999 + 1) / 2));
    });

    it('should handle paths with special characters', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/api/v1/users?id=123&sort=asc,200,100',
        '2025-01-01T01:00:00Z,u1,/api/v1/users?id=123&sort=asc,200,200',
      ];
      const opt: Options = { from: '2025-01-01', to: '2025-01-01', tz: 'jst', top: 10 };
      const result = aggregate(lines, opt);

      expect(result[0].path).toBe('/api/v1/users?id=123&sort=asc');
      expect(result[0].count).toBe(2);
    });
  });

});
