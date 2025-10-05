import { describe, expect, it } from 'vitest';
import { parseLines } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three', // 4列のみ
      '2025-01-03T10:13:00Z,u2,/b,200,abc', // latency非数値
      '2025-01-03T10:14:00Z,u3,/c,notnum,150', // status非数値
      'invalid-timestamp,u4,/d,200,100', // 不正なtimestamp
      ',u5,/e,200,100', // timestamp空
      '2025-01-03T10:15:00Z,,/f,200,100', // userId空
      '2025-01-03T10:16:00Z,u6,,200,100', // path空
      '2025-01-03T10:17:00Z,u7,/g,200,200', // 正常
    ]);
    expect(rows.length).toBe(2); // 最初と最後のみ有効
    expect(rows[0].userId).toBe('u1');
    expect(rows[1].userId).toBe('u7');
  });

  it.todo('aggregate basic');
});
