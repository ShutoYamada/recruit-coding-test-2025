// scr/q2/core.spec.ts

import { describe, expect, it } from 'vitest';
import { aggregate } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows', () => {
    const rows = aggregate(
      ['2025-01-03T10:12:00Z,u1,/a,200,100', 'broken,row,only,three'],
      { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 5 }
    );
    expect(rows.length).toBe(1);
  });

  it('filters by date inclusive', () => {
    const input = [
      '2025-01-01T00:00:00Z,u1,/a,200,100',
      '2025-01-31T23:59:59Z,u2,/a,200,200',
      '2024-12-31T23:59:59Z,u3,/a,200,300',
    ];
    const out = aggregate(input, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 5,
    });
    expect(out.map((o) => o.date)).toEqual(['2025-01-01', '2025-02-01']);
  });

  it('converts timezone correctly', () => {
    const input = ['2025-01-01T16:00:00Z,u1,/a,200,100'];

    const out = aggregate(input, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 5,
    });
    expect(out[0].date).toBe('2025-01-02');
  });

  it('computes count and average latency', () => {
    const input = [
      '2025-01-03T10:12:00Z,u1,/api/orders,200,120',
      '2025-01-03T10:13:00Z,u2,/api/orders,200,180',
    ];
    const out = aggregate(input, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 5,
    });
    expect(out[0]).toMatchObject({
      path: '/api/orders',
      count: 2,
      avgLatency: 150,
    });
  });

  it('respects top N per date', () => {
    const input = [
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      '2025-01-03T10:12:00Z,u2,/a,200,200',
      '2025-01-03T11:12:00Z,u1,/b,200,300',
    ];
    const out = aggregate(input, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 1,
    });
    expect(out.length).toBe(1);
    expect(out[0].path).toBe('/a');
  });
});
