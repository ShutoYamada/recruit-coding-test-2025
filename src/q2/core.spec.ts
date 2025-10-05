import { describe, expect, it } from 'vitest';
import { parseLines } from './core.js';

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


  it.todo('aggregate basic');
});
