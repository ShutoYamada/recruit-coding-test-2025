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

  it('aggregate basic' , () => {
    const lines = [
      '2025-10-05T12:00:00Z,u1,/api/orders,200,150',
      '2025-10-05T12:15:00Z,u2,/api/orders,200,200',
      '2025-10-05T13:00:00Z,u3,/api/products,200,120',
      '2025-10-06T00:30:00Z,u1,/api/orders,200,170',
    ];
    const opt = {
      from: '2025-10-05',
      to: '2025-10-06',
      tz: 'jst' as const,
      top: 3,
    };
    const result = aggregate(lines, opt);

    expect(result).toEqual([
       { date: '2025-10-05', path: '/api/orders', count: 2, avgLatency: 175 },
      { date: '2025-10-05', path: '/api/products', count: 1, avgLatency: 120 },
      { date: '2025-10-06', path: '/api/orders', count: 1, avgLatency: 170 },
    ]);
  });
});

describe('Q2 core - extra cases', () => {
  it('filter by date: excludes out-of-range', () => {
    const lines = [
      '2025-10-04T23:59:59Z,u1,/api/orders,200,100', // out
      '2025-10-05T00:00:00Z,u2,/api/orders,200,200', // in
      '2025-10-06T23:59:59Z,u3,/api/orders,200,300', // in
      '2025-10-07T00:00:00Z,u4,/api/orders,200,400', // out
    ];
    const opt = {
      from: '2025-10-05',
      to: '2025-10-06',
      tz: 'jst' as const,
      top: 5,
    };
    const result = aggregate(lines, opt);
  expect(result.map(r => r.date)).toEqual(['2025-10-05']);
  });

  it('timezone conversion: JST/ICT', () => {
    const lines = [
      '2025-10-05T15:30:00Z,u1,/api/orders,200,100', // JST: 2025-10-06
      '2025-10-05T00:30:00Z,u2,/api/orders,200,200', // JST: 2025-10-05
      '2025-10-05T17:00:00Z,u3,/api/orders,200,300', // ICT: 2025-10-06
    ];
    const optJST = {
      from: '2025-10-05',
      to: '2025-10-06',
      tz: 'jst' as const,
      top: 5,
    };
    const optICT = {
      from: '2025-10-05',
      to: '2025-10-06',
      tz: 'ict' as const,
      top: 5,
    };
    const resultJST = aggregate(lines, optJST);
    const resultICT = aggregate(lines, optICT);
    expect(resultJST.some(r => r.date === '2025-10-06')).toBe(true);
    expect(resultICT.some(r => r.date === '2025-10-06')).toBe(true);
  });

  it('top N and sorting: count desc, path asc, date asc', () => {
    const lines = [
      '2025-10-05T12:00:00Z,u1,/api/a,200,100',
      '2025-10-05T12:01:00Z,u2,/api/b,200,200',
      '2025-10-05T12:02:00Z,u3,/api/b,200,300',
      '2025-10-06T12:00:00Z,u4,/api/a,200,400',
      '2025-10-06T12:01:00Z,u5,/api/b,200,500',
      '2025-10-06T12:02:00Z,u6,/api/b,200,600',
      '2025-10-06T12:03:00Z,u7,/api/c,200,700',
    ];
    const opt = {
      from: '2025-10-05',
      to: '2025-10-06',
      tz: 'jst' as const,
      top: 2,
    };
    const result = aggregate(lines, opt);
    expect(result).toEqual([
      { date: '2025-10-05', path: '/api/b', count: 2, avgLatency: 250 },
      { date: '2025-10-05', path: '/api/a', count: 1, avgLatency: 100 },
      { date: '2025-10-06', path: '/api/b', count: 2, avgLatency: 550 },
      { date: '2025-10-06', path: '/api/a', count: 1, avgLatency: 400 },
    ]);
  });

  it('skip lines with invalid data', () => {
    const lines = [
      '2025-10-05T12:00:00Z,u1,/api/orders,200,150',
      'invalid-timestamp,u2,/api/orders,200,200', // invalid timestamp
      '2025-10-05T12:15:00Z,u3,/api/orders,abc,120', // invalid status
      '2025-10-05T13:00:00Z,u4,/api/orders,200,xyz', // invalid latency
      '2025-10-05T13:00:00Z,u5,/api/orders,200', // missing latency
    ];
    const opt = {
      from: '2025-10-05',
      to: '2025-10-05',
      tz: 'jst' as const,
      top: 5,
    };
    const result = aggregate(lines, opt);
    expect(result).toEqual([
      { date: '2025-10-05', path: '/api/orders', count: 1, avgLatency: 150 },
    ]);
  });

  it('large data: handles many rows and paths', () => {
    const lines: string[] = [];
    for (let i = 0; i < 100; i++) {
      lines.push(`2025-10-05T12:00:00Z,u${i},/api/path${i%10},200,${100+i}`);
    }
    const opt = {
      from: '2025-10-05',
      to: '2025-10-05',
      tz: 'jst' as const,
      top: 3,
    };
    const result = aggregate(lines, opt);
  expect(result.length).toBe(3);
  });
});
