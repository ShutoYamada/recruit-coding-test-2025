import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
    ]);
    expect(rows.length).toBe(1);
  });

  it.todo('aggregate basic');
});

describe('Q2 aggregate', () => {
  it('aggregate basic', () => {
    const lines = [
      '2025-01-03T10:12:00Z,u1,/api/orders,200,120',
      '2025-01-03T10:13:00Z,u2,/api/orders,200,180',
      '2025-01-03T11:00:00Z,u3,/api/users,200,90',
      '2025-01-04T00:10:00Z,u1,/api/orders,200,110',
    ];

    const parsed = parseLines(lines);
    const out = aggregate(lines, { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 3 });

    const expected = [
      { date: '2025-01-03', path: '/api/orders', count: 2, avgLatency: 150 },
      { date: '2025-01-03', path: '/api/users', count: 1, avgLatency: 90 },
      { date: '2025-01-04', path: '/api/orders', count: 1, avgLatency: 110 },
    ];

    expect(parsed.length).toBe(4);
    expect(out).toEqual(expected);
  });
});
