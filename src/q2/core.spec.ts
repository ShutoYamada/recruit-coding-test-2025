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

  it('aggregate basic', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T10:00:00Z,u1,/api/orders,200,100',
      '2025-01-03T11:00:00Z,u2,/api/orders,200,200',
    ];
    const result = aggregate(lines.slice(1), {
      from: '2025-01-03',
      to: '2025-01-03',
      tz: 'jst',
      top: 5,
    });
    expect(result).toEqual([
      { date: '2025-01-03', path: '/api/orders', count: 2, avgLatency: 150 },
    ]);
  });

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
});
