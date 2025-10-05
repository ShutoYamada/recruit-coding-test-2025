import { describe, expect, it } from 'vitest';
import { parseLines, aggregate } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
    ]);
    expect(rows.length).toBe(1);
  });

  it('aggregate: basic aggregation, timezone (JST) conversion and ordering', () => {
    const lines = [
      // UTC 2025-01-01T23:30 -> JST 2025-01-02
      '2025-01-01T23:30:00Z,u1,/api/a,200,100',
      // UTC 2025-01-02T00:10 -> JST 2025-01-02
      '2025-01-02T00:10:00Z,u2,/api/a,200,200',
      // same day
      '2025-01-02T12:00:00Z,u3,/api/b,200,300',
      // next day
      '2025-01-03T01:00:00Z,u4,/api/c,200,400',
    ];

    const out = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-03',
      tz: 'jst',
      top: 5,
    });

    expect(out).toEqual([
      { date: '2025-01-02', path: '/api/a', count: 2, avgLatency: 150 },
      { date: '2025-01-02', path: '/api/b', count: 1, avgLatency: 300 },
      { date: '2025-01-03', path: '/api/c', count: 1, avgLatency: 400 },
    ]);
  });

  it('aggregate: top-N per date and tiebreaker by path asc', () => {
    const lines = [
      '2025-01-05T00:00:00Z,u1,/a,200,100',
      '2025-01-05T00:10:00Z,u2,/b,200,100',
      '2025-01-05T01:00:00Z,u3,/c,200,100',
      // another date with ties
      '2025-01-06T00:00:00Z,u1,/z,200,50',
      '2025-01-06T00:10:00Z,u2,/y,200,50',
    ];

    const out = aggregate(lines, {
      from: '2025-01-05',
      to: '2025-01-06',
      tz: 'jst',
      top: 2,
    });

    // For 2025-01-05, three paths with count=1 -> choose /a and /b (path asc)
    // For 2025-01-06, two paths with count=1 -> choose /y and /z (path asc)
    expect(out).toEqual([
      { date: '2025-01-05', path: '/a', count: 1, avgLatency: 100 },
      { date: '2025-01-05', path: '/b', count: 1, avgLatency: 100 },
      { date: '2025-01-06', path: '/y', count: 1, avgLatency: 50 },
      { date: '2025-01-06', path: '/z', count: 1, avgLatency: 50 },
    ]);
  });

  it('aggregate: date filter boundaries inclusive (UTC)', () => {
    const lines = [
      '2025-01-10T00:00:00Z,u1,/edge,200,10',
      '2025-01-10T23:59:59Z,u2,/edge,200,30',
      '2025-01-11T00:00:00Z,u3,/edge,200,50',
    ];

    const out = aggregate(lines, {
      from: '2025-01-10',
      to: '2025-01-10',
      tz: 'jst',
      top: 10,
    });

    // Both first two are inside UTC 2025-01-10; aggregated to JST date 2025-01-10/2025-01-11 depending on tz,
    // but since tz shifts, ensure entries are included by UTC filter first then tz grouping applied.
    // Here both first two timestamps are on UTC 2025-01-10, included, and map to JST dates:
    // 2025-01-10T00:00:00Z -> JST 2025-01-10
    // 2025-01-10T23:59:59Z -> JST 2025-01-11
    // So result will have two different dates.
    expect(out).toEqual([
      { date: '2025-01-10', path: '/edge', count: 1, avgLatency: 10 },
      { date: '2025-01-11', path: '/edge', count: 1, avgLatency: 30 },
    ]);
  });

  it('aggregate: avgLatency rounding', () => {
    const lines = [
      '2025-01-20T12:00:00Z,u1,/r,200,100',
      '2025-01-20T12:10:00Z,u2,/r,200,101',
    ];
    const out = aggregate(lines, {
      from: '2025-01-20',
      to: '2025-01-20',
      tz: 'jst',
      top: 10,
    });
    // avg = 100.5 -> rounded to 101
    expect(out).toEqual([{ date: '2025-01-20', path: '/r', count: 2, avgLatency: 101 }]);
  });
});
