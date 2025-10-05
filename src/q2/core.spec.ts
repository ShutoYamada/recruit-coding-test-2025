import { describe, expect, it } from 'vitest';
import { aggregate, Options, parseLines } from './core.js';

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

describe('aggregate', () => {
  it('should group and rank correctly for sample data', () => {
    const lines = [
      '2025-01-03T10:12:00Z,u1,/api/orders,200,120',
      '2025-01-03T10:13:00Z,u2,/api/orders,200,180',
      '2025-01-03T11:00:00Z,u3,/api/users,200,90',
      '2025-01-04T00:10:00Z,u1,/api/orders,200,110',
    ];

    const opt: Options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 3,
    };

    const result = aggregate(lines, opt);
    expect(result).toEqual([
      { date: '2025-01-03', path: '/api/orders', count: 2, avgLatency: 150 },
      { date: '2025-01-03', path: '/api/users', count: 1, avgLatency: 90 },
      { date: '2025-01-04', path: '/api/orders', count: 1, avgLatency: 110 },
    ]);
  });

  it('should group and rank correctly for sample data', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/orders,200,100',
      '2025-01-15T10:00:00Z,u2,/api/orders,200,200',
      '2025-02-01T10:00:00Z,u3,/api/orders,200,300',
    ];

    const opt: Options = {
      from: '2025-01-10',
      to: '2025-01-31',
      tz: 'jst',
      top: 5,
    };

    const result = aggregate(lines, opt);
    expect(result).toEqual([
      { date: '2025-01-15', path: '/api/orders', count: 1, avgLatency: 200 },
    ]);
  });

  it('should return empty array if no data in date range', () => {
    const lines = [
      '2025-01-01T10:00:00Zs,u1,/api/a,200,100',
      '2025-01-01T11:00:00Z,u2,/api/b,200,200',
    ];

    const opt: Options = {
      from: '2025-02-01',
      to: '2025-02-28',
      tz: 'jst',
      top: 5,
    };

    const result = aggregate(lines, opt);
    expect(result).toEqual([]);
  });
  it('should handle empty input', () => {
    const lines: string[] = [];

    const opt: Options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 5,
    };

    const result = aggregate(lines, opt);
    expect(result).toEqual([]);
  });
  it('should limit results to top N per day', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/a,200,100',
      '2025-01-01T11:00:00Z,u2,/api/b,200,200',
      '2025-01-01T12:00:00Z,u3,/api/c,200,300',
      '2025-01-01T13:00:00Z,u4,/api/d,200,400',
    ];

    const opt: Options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 2,
    };

    const result = aggregate(lines, opt);
    expect(result).toEqual([
      { date: '2025-01-01', path: '/api/a', count: 1, avgLatency: 100 },
      { date: '2025-01-01', path: '/api/b', count: 1, avgLatency: 200 },
    ]);
  });

  it('should convert dates correctly for ICT timezone', () => {
    const lines = [
      '2025-01-01T16:00:00Z,u1,/api/a,200,100', // 2025-01-01 23:00 ICT
      '2025-01-01T17:00:00Z,u2,/api/b,200,200', // 2025-01-02 00:00 ICT
    ];

    const opt: Options = {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'ict',
      top: 5,
    };

    const result = aggregate(lines, opt);
    expect(result).toEqual([
      { date: '2025-01-01', path: '/api/a', count: 1, avgLatency: 100 },
      { date: '2025-01-02', path: '/api/b', count: 1, avgLatency: 200 },
    ]);
  });

  it('should handle multiple entries for same path and date', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/a,200,100',
      '2025-01-01T11:00:00Z,u2,/api/a,200,300',
      '2025-01-01T12:00:00Z,u3,/api/b,200,200',
    ];

    const opt: Options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 5,
    };

    const result = aggregate(lines, opt);
    expect(result).toEqual([
      { date: '2025-01-01', path: '/api/a', count: 2, avgLatency: 200 },
      { date: '2025-01-01', path: '/api/b', count: 1, avgLatency: 200 },
    ]);
  });
  it('should ignore malformed lines', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/a,200,100',
      'malformed,line,here',
      '2025-01-01T11:00:00Z,u2,/api/b,200,200',
    ];
    const opt: Options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 5,
    };

    const result = aggregate(lines, opt);
    expect(result).toEqual([
      { date: '2025-01-01', path: '/api/a', count: 1, avgLatency: 100 },
      { date: '2025-01-01', path: '/api/b', count: 1, avgLatency: 200 },
    ]);
  });

  it('should handle zero latency entries', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/a,200,0',
      '2025-01-01T11:00:00Z,u2,/api/b,200,200',
    ];
    const opt: Options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 5,
    };

    const result = aggregate(lines, opt);
    expect(result).toEqual([
      { date: '2025-01-01', path: '/api/a', count: 1, avgLatency: 0 },
      { date: '2025-01-01', path: '/api/b', count: 1, avgLatency: 200 },
    ]);
  });

  it('should handle non-200 status codes', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/a,500,100',
      '2025-01-01T11:00:00Z,u2,/api/b,404,200',
    ];
    const opt: Options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 5,
    };

    const result = aggregate(lines, opt);
    expect(result).toEqual([
      { date: '2025-01-01', path: '/api/a', count: 1, avgLatency: 100 },
      { date: '2025-01-01', path: '/api/b', count: 1, avgLatency: 200 },
    ]);
  });
});

