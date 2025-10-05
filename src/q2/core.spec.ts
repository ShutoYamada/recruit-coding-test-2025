import { describe, expect, it } from 'vitest';
import { parseLines, filterByDate } from './core.js';

describe('Q2 core', () => {
  // parseLines: skip invalid rows
  // 無効な行をスキップすること
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
      '2025-01-03T10:15:00Z,u2,/b,404,xyz',
      '2025-01-03T10:20:00Z,u3,/c,xyz,300',
      'abx,u4,/d,500,400',
      'timestamp,u5,/e,600,500',
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].userId).toBe('u1');
  });


  // filterByDate: filter rows by date range
  // 日付範囲でフィルターすること
  it('dateFiltering: filters by date range', () => {
    const input = [
      '2025-01-01T23:59:59Z,u1,/a,200,100',
      '2025-01-02T00:00:00Z,u2,/b,200,100',
      '2025-01-15T12:00:00Z,u3,/c,200,100',
      '2025-01-31T23:59:59Z,u4,/d,200,100',
      '2025-02-01T00:00:00Z,u5,/e,200,100',
    ]
    const rows = parseLines(input);
    const filtered = filterByDate(rows, '2025-01-02', '2025-01-31');
    expect(filtered.length).toBe(3);
    expect(filtered[0].userId).toBe('u2');
    expect(filtered[2].userId).toBe('u4');
  });

  it.todo('aggregate basic');
});
