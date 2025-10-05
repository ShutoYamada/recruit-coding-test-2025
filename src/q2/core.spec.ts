import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  // Test 1: Parse broken rows
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
    ]);
    expect(rows.length).toBe(1);
  });

  // Test 2: Parse invalid numbers
  it('parseLines: skips rows with invalid numbers', () => {
    const rows = parseLines([
      '2025-01-03T10:00:00Z,u1,/a,200,100',
      '2025-01-03T10:00:00Z,u2,/b,abc,100', // status = abc
      '2025-01-03T10:00:00Z,u3,/c,200,xyz', // latency = xyz
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].userId).toBe('u1');
  });

  // Test 3: Basic aggregation
  it('aggregate basic', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/api/orders,200,100',
      '2025-01-03T11:00:00Z,u2,/api/orders,200,200',
    ];
    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-03',
      tz: 'jst',
      top: 5,
    });
    expect(result).toEqual([
      { date: '2025-01-03', path: '/api/orders', count: 2, avgLatency: 150 },
    ]);
  });

  // Test 4: Date filter boundaries
  it('filterByDate: includes both from and to dates', () => {
    const lines = [
      '2025-01-01T00:00:00Z,u1,/a,200,100', // exactly at from
      '2025-01-02T12:00:00Z,u2,/b,200,100', // middle
      '2025-01-03T23:59:59Z,u3,/c,200,100', // exactly at to
      '2025-01-04T00:00:00Z,u4,/d,200,100', // after to
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-03',
      tz: 'jst',
      top: 5,
    });
    expect(result.length).toBe(3); // Only first 3
  });

  // Test 5: Timezone JST crosses date boundary
  it('timezone conversion: UTC to JST crosses date boundary', () => {
    // 2025-01-03T23:00:00Z = 2025-01-04T08:00:00 JST
    const lines = ['2025-01-03T23:00:00Z,u1,/api/test,200,100'];
    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-04',
      tz: 'jst',
      top: 5,
    });
    expect(result[0].date).toBe('2025-01-04');
  });

  // Test 6: Timezone ICT
  it('timezone conversion: ICT (UTC+7)', () => {
    // 2025-01-03T18:00:00Z = 2025-01-04T01:00:00 ICT
    const lines = ['2025-01-03T18:00:00Z,u1,/api/test,200,100'];
    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-04',
      tz: 'ict',
      top: 5,
    });
    expect(result[0].date).toBe('2025-01-04');
  });

  // Test 7: Average latency rounding
  it('avgLatency: rounds to nearest integer', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/api/test,200,100',
      '2025-01-03T10:00:00Z,u2,/api/test,200,101',
    ];
    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-03',
      tz: 'jst',
      top: 5,
    });
    expect(result[0].avgLatency).toBe(101); // (100+101)/2 = 100.5 → 101
  });

  // Test 8: Top N per date (not global)
  it('top N: applied per date, not globally', () => {
    const lines = [
      // Date 1: 3 paths
      '2025-01-03T10:00:00Z,u1,/api/a,200,100',
      '2025-01-03T10:00:00Z,u1,/api/a,200,100', // count=2
      '2025-01-03T10:00:00Z,u2,/api/b,200,100', // count=1
      '2025-01-03T10:00:00Z,u3,/api/c,200,100', // count=1
      // Date 2: 2 paths
      '2025-01-04T10:00:00Z,u4,/api/d,200,100', // count=1
      '2025-01-04T10:00:00Z,u5,/api/e,200,100', // count=1
    ];
    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-04',
      tz: 'jst',
      top: 2, // Top 2 per date
    });
    expect(result.length).toBe(4); // 2 from date1 + 2 from date2
    expect(result.filter((r) => r.date === '2025-01-03').length).toBe(2);
    expect(result.filter((r) => r.date === '2025-01-04').length).toBe(2);
  });

  // Test 9: Tie-breaking by path (same count)
  it('top N per date with tie-breaking by path', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/api/b,200,100',
      '2025-01-03T10:00:00Z,u2,/api/a,200,100',
    ];
    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-03',
      tz: 'jst',
      top: 1,
    });
    expect(result[0].path).toBe('/api/a');
  });

  // Test 10: Final sort order
  it('final sort: date ASC, count DESC, path ASC', () => {
    const lines = [
      '2025-01-04T10:00:00Z,u1,/api/z,200,100', // date2, count=1
      '2025-01-03T10:00:00Z,u2,/api/b,200,100', // date1, count=2
      '2025-01-03T10:00:00Z,u2,/api/b,200,100',
      '2025-01-03T10:00:00Z,u3,/api/a,200,100', // date1, count=2
      '2025-01-03T10:00:00Z,u3,/api/a,200,100',
    ];
    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-04',
      tz: 'jst',
      top: 5,
    });
    // Expected order: date1(/api/a, count=2), date1(/api/b, count=2), date2(/api/z, count=1)
    expect(result[0]).toMatchObject({
      date: '2025-01-03',
      path: '/api/a',
      count: 2,
    });
    expect(result[1]).toMatchObject({
      date: '2025-01-03',
      path: '/api/b',
      count: 2,
    });
    expect(result[2]).toMatchObject({
      date: '2025-01-04',
      path: '/api/z',
      count: 1,
    });
  });

  // Test 11: Empty result when no matches
  it('aggregate: returns empty array when no data matches filter', () => {
    const lines = ['2025-01-01T10:00:00Z,u1,/api/test,200,100'];
    const result = aggregate(lines, {
      from: '2025-01-10',
      to: '2025-01-20',
      tz: 'jst',
      top: 5,
    });
    expect(result).toEqual([]);
  });
});
