import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

// eslint-disable-next-line max-lines-per-function
describe('Q2 core', () => {
  it('parseLines: skips broken rows (missing column, non-numeric, invalid timestamp)', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
      'broken,row,only,three,parts',
    ]);

    expect(rows.length).toBe(1);
    expect(rows[0].path).toBe('/a');
  });

  // [C2] Aggregate Basic
  it('aggregate basic: groups, counts, and calculates avgLatency (rounding check)', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/api/odd,200,100',
      '2025-01-03T10:00:00Z,u2,/api/odd,200,101', // Avg: 100.5 -> Round(101)
      '2025-01-03T11:00:00Z,u3,/api/even,200,100',
      '2025-01-03T11:00:00Z,u4,/api/even,200,102',
      '2025-01-03T11:00:00Z,u5,/api/even,200,103', // Avg: 305/3 = 101.666 -> Round(102)
    ];

    const options = {
      from: '2025-01-03',
      to: '2025-01-03',
      tz: 'jst' as const, // UTC+9
      top: 5,
    };

    const result = aggregate(lines, options);

    expect(result.length).toBe(2);

    const odd = result.find((r) => r.path === '/api/odd');
    const even = result.find((r) => r.path === '/api/even');

    expect(odd?.count).toBe(2);
    expect(odd?.avgLatency).toBe(101); // 100.5 -> 101

    expect(even?.count).toBe(3);
    expect(even?.avgLatency).toBe(102); // 101.666 -> 102
  });

  it('FilterByDate: should correctly filter by from/to inclusive (UTC)', () => {
    const lines = [
      '2025-01-01T00:00:00Z,u1,/a,200,100',
      '2024-12-31T23:59:59Z,u2,/b,200,100',
      '2025-01-02T23:59:59Z,u3,/c,200,100',
      '2025-01-03T00:00:00Z,u4,/d,200,100',
    ];

    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 5,
    });

    expect(result.length).toBe(2);
    expect(result.map((r) => r.path)).toEqual(['/a', '/c']);
  });

  // [C4] Timezone Cross-Day Check
  it('TZ Cross Day: correctly assigns logs near midnight to the correct localized date', () => {
    const lines = [
      // UTC 14:59:59 là 23:59:59 JST (01-01)
      '2025-01-01T14:59:59Z,u1,/path_01,200,100',
      // UTC 15:00:00 là 00:00:00 JST (01-02)
      '2025-01-01T15:00:00Z,u2,/path_02,200,200',
      // UTC 17:00:00 là 00:00:00 ICT (01-02)
      '2025-01-01T16:59:59Z,u3,/path_03,200,300', // 23:59:59 ICT (01-01)
    ];

    // 1. Check JST (UTC+9)
    const jstResult = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 5,
    });
    expect(jstResult.length).toBe(3);
    expect(jstResult.filter((r) => r.date === '2025-01-01').length).toBe(1); // /path_01
    expect(jstResult.filter((r) => r.date === '2025-01-02').length).toBe(2); // /path_02, /path_03

    // Test ICT (UTC+7)
    const ictResult = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'ict',
      top: 5,
    });
    expect(ictResult.length).toBe(3);
    expect(ictResult.filter((r) => r.date === '2025-01-01').length).toBe(3);
    expect(ictResult.filter((r) => r.date === '2025-01-02').length).toBe(0);
  });

  // [C5/C6] Ranking and Final Ordering
  it('Ranking and Ordering: should apply topN per day and ensure final sort order (date ASC, count DESC, path ASC)', () => {
    const lines = [
      // Day 1 JST (2025-01-01) - 2 groups
      '2025-01-01T05:00:00Z,u1,/api/Z,200,100', // C=1
      '2025-01-01T05:00:00Z,u2,/api/A,200,200', // C=1

      // Day 2 JST (2025-01-02) - 3 groups
      '2025-01-01T15:00:00Z,u3,/api/B,200,300', // C=1 (01-02 JST)
      '2025-01-01T15:00:00Z,u4,/api/B,200,400', // C=2
      '2025-01-01T15:00:00Z,u5,/api/A,200,500', // C=1
      '2025-01-01T15:00:00Z,u6,/api/C,200,600', // C=1
    ];

    // Top N = 1
    const resultTop1 = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 1,
    });
    // 01-01: A vs Z (C=1). A WIN (path ASC).
    // 01-02: B(C=2) vs A(C=1) vs C(C=1). B WIN (count DESC).
    expect(resultTop1.length).toBe(2);
    expect(resultTop1[0].date).toBe('2025-01-01');
    expect(resultTop1[0].path).toBe('/api/A');
    expect(resultTop1[1].date).toBe('2025-01-02');
    expect(resultTop1[1].path).toBe('/api/B');

    // Top N = 2
    const resultTop2 = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 2,
    });

    expect(resultTop2.length).toBe(4);
    expect(resultTop2[0].date).toBe('2025-01-01');
    expect(resultTop2[0].path).toBe('/api/A');
    expect(resultTop2[1].date).toBe('2025-01-01');
    expect(resultTop2[1].path).toBe('/api/Z');
    expect(resultTop2[2].date).toBe('2025-01-02');
    expect(resultTop2[2].path).toBe('/api/B');
    expect(resultTop2[3].date).toBe('2025-01-02');
    expect(resultTop2[3].path).toBe('/api/A');
  });
});
