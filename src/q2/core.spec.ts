import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken or invalid rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
      '2025-01-03T10:13:00Z,u2,/b,abc,90',
      '2025-01-03T10:14:00Z,u3,/c,200,xyz',
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

  it('aggregate: filters rows within from/to inclusive', () => {
    const lines = [
      '2025-01-01T00:00:00Z,u1,/x,200,100',
      '2025-01-02T12:00:00Z,u2,/x,200,200',
      '2025-01-03T23:59:59Z,u3,/x,200,300',
      '2025-01-04T00:00:00Z,u4,/x,200,400',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-03',
      tz: 'jst',
      top: 10,
    });
    const counts = result.reduce((sum, r) => sum + r.count, 0);
    expect(counts).toBe(3);
  });

  it('aggregate: converts UTC → JST/ICT correctly (day shift)', () => {
    const lines = [
      '2025-01-01T15:30:00Z,u1,/a,200,100',
      '2025-01-01T17:30:00Z,u2,/a,200,200',
    ];

    const jst = aggregate([lines[0]], {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 5,
    });
    const ict = aggregate([lines[1]], {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'ict',
      top: 5,
    });

    expect(jst[0].date).toBe('2025-01-02');
    expect(ict[0].date).toBe('2025-01-02');
  });

  it('aggregate: groups by date × path and computes average latency', () => {
    const lines = [
      '2025-01-03T00:00:00Z,u1,/api/orders,200,100',
      '2025-01-03T01:00:00Z,u2,/api/orders,200,200',
      '2025-01-03T02:00:00Z,u3,/api/users,200,90',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 5,
    });
    expect(result).toContainEqual({
      date: '2025-01-03',
      path: '/api/orders',
      count: 2,
      avgLatency: 150,
    });
    expect(result).toContainEqual({
      date: '2025-01-03',
      path: '/api/users',
      count: 1,
      avgLatency: 90,
    });
  });

  it('aggregate: ranks top N per date correctly', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/a,200,100',
      '2025-01-03T11:00:00Z,u2,/a,200,100',
      '2025-01-03T12:00:00Z,u3,/b,200,100',
      '2025-01-03T13:00:00Z,u4,/c,200,100',
      '2025-01-04T00:00:00Z,u1,/z,200,100',
      '2025-01-04T01:00:00Z,u2,/y,200,100',
    ];
    const result = aggregate(lines, {
      from: '2025-01-03',
      to: '2025-01-04',
      tz: 'jst',
      top: 2,
    });

    const day3 = result.filter((r) => r.date === '2025-01-03');
    expect(day3.length).toBe(2);
    expect(day3[0].path).toBe('/a');
  });
});
