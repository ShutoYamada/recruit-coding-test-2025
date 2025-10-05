import { describe, expect, it } from 'vitest';
import { aggregate, parseLines, type Output } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
    ]);
    expect(rows.length).toBe(1);
  });

  // it.todo('aggregate basic');
  // add custom test 1:
  it('UTC range is inclusive', () => {
    const lines = [
      '2025-01-01T00:00:00Z,u1,/x,200,100',
      '2025-01-01T12:00:00Z,u2,/x,200,200',
      '2025-01-01T23:59:59Z,u3,/y,200,300',
      '2024-12-31T23:59:59Z,u0,/drop,200,999',
      '2025-01-02T00:00:00Z,u9,/drop,200,999',
    ];
    const out = aggregate(lines, { from: '2025-01-01', to: '2025-01-01', tz: 'ict', top: 10 });
    expect(out).toEqual<Output>([
      { date: '2025-01-01', path: '/x', count: 2, avgLatency: 150 },
      { date: '2025-01-02', path: '/y', count: 1, avgLatency: 300 },
    ]);
  });

  // add custom test 2:
  it('Aggregates & rounds avgLatency', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/a,200,100',
      '2025-01-03T10:05:00Z,u2,/a,200,101',
      '2025-01-03T10:10:00Z,u3,/a,200,101',
      '2025-01-03T10:12:00Z,u4,/b,200,250',
    ];
    const out = aggregate(lines, { from: '2025-01-03', to: '2025-01-03', tz: 'ict', top: 5 });
    expect(out).toEqual<Output>([
      { date: '2025-01-03', path: '/a', count: 3, avgLatency: 101 },
      { date: '2025-01-03', path: '/b', count: 1, avgLatency: 250 },
    ]);
  });
});
