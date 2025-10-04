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

  // ------------------------------
  // [C1] 基本集計（件数・平均遅延）
  // ------------------------------
  it('aggregate basic: counts and averages correctly', () => {
    const lines = [
      '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
      '2025-01-03T10:13:00Z,u2,/api/orders,200,200',
      '2025-01-03T10:14:00Z,u3,/api/users,200,150',
    ];
    const result = aggregate(lines, { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 5 });
    expect(result).toEqual([
      { date: '2025-01-03', path: '/api/orders', count: 2, avgLatency: 150 },
      { date: '2025-01-03', path: '/api/users', count: 1, avgLatency: 150 },
    ]);
  });

  // ------------------------------
  // [C2] タイムゾーン変換（UTC→ICT）
  // ------------------------------
  it('aggregate with timezone ICT: converts UTC to ICT date', () => {
    const lines = [
      '2025-01-02T17:00:00Z,u1,/api/test,200,100', // ICT 2025-01-03
    ];
    const result = aggregate(lines, { from: '2025-01-01', to: '2025-01-31', tz: 'ict', top: 5 });
    expect(result[0].date).toBe('2025-01-03');
  });
});
