import { describe, expect, it } from 'vitest';
import { parseLines, aggregate } from './core.js';

// eslint-disable-next-line max-lines-per-function
describe('Q2 core', () => {
  // ------------------------------
  // [T1] parseLines: skip broken rows
  // ------------------------------
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
      '2025-01-03T11:00:00Z,u2,/b,200,150',
    ]);
    expect(rows.length).toBe(2);
    expect(rows[0].path).toBe('/a');
  });

  // ------------------------------
  // [T2] basic aggregate
  // ------------------------------
  it('aggregate basic', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/api/orders,200,100',
      '2025-01-03T11:00:00Z,u2,/api/orders,200,200',
      '2025-01-03T12:00:00Z,u3,/api/users,200,90',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 5,
    });
    expect(result).toEqual([
      { date: '2025-01-03', path: '/api/orders', count: 2, avgLatency: 150 },
      { date: '2025-01-03', path: '/api/users', count: 1, avgLatency: 90 },
    ]);
  });

  // ------------------------------
  // [T3] filter by from/to boundaries
  // ------------------------------
  it('aggregate: respects from/to boundaries (inclusive)', () => {
    const lines = [
      '2025-01-01T00:00:00Z,u1,/a,200,100', // exactly from
      '2025-01-02T00:00:00Z,u2,/a,200,200',
      '2025-01-03T23:59:59Z,u3,/a,200,300', // exactly to
      '2025-01-04T00:00:00Z,u4,/a,200,400', // out of range
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-03',
      tz: 'jst',
      top: 5,
    });
    expect(result.map((r) => r.date)).toContain('2025-01-01');
    expect(result.map((r) => r.date)).toContain('2025-01-03');
    expect(result.some((r) => r.date === '2025-01-04')).toBe(false);
  });

  // ------------------------------
  // [T4] timezone conversion (UTC→JST/ICT)
  // ------------------------------
  it('timezone conversion works correctly', () => {
    const lines = [
      // UTC 2025-01-01 15:00 → JST = 2025-01-02 00:00
      '2025-01-01T15:00:00Z,u1,/a,200,100',
      // UTC 2025-01-01 17:00 → ICT = 2025-01-02 00:00
      '2025-01-01T17:00:00Z,u2,/b,200,200',
    ];
    const jst = aggregate(lines.slice(0, 1), {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 5,
    });
    const ict = aggregate(lines.slice(1, 2), {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'ict',
      top: 5,
    });
    expect(jst[0].date).toBe('2025-01-02');
    expect(ict[0].date).toBe('2025-01-02');
  });

  // ------------------------------
  // [T5] top N per date
  // ------------------------------
  it('aggregate: returns top N per date by count desc', () => {
    const lines = [
      '2025-01-01T00:00:00Z,u1,/a,200,100',
      '2025-01-01T01:00:00Z,u2,/a,200,200',
      '2025-01-01T02:00:00Z,u3,/b,200,150',
      '2025-01-01T03:00:00Z,u4,/c,200,100',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-01',
      tz: 'jst',
      top: 2,
    });
    // Only top 2 counts (by count desc, path asc if tie)
    expect(result.length).toBe(2);
    expect(result[0].path).toBe('/a');
  });

  // ------------------------------
  // [T6] stable order: date ASC, count DESC, path ASC
  // ------------------------------
  it('aggregate: final output sorted by date asc, count desc, path asc', () => {
    const lines = [
      '2025-01-03T00:00:00Z,u1,/a,200,100',
      '2025-01-03T00:00:00Z,u2,/b,200,100',
      '2025-01-02T00:00:00Z,u3,/a,200,100',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-04',
      tz: 'jst',
      top: 5,
    });
    const dates = result.map((r) => r.date);
    expect(dates).toEqual(['2025-01-02', '2025-01-03', '2025-01-03']);
  });
});
