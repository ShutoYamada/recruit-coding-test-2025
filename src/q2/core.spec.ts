import { describe, expect, it } from 'vitest';
import { parseLines } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
    ]);
    expect(rows.length).toBe(1);
  });

    // 不正な数値はNaNに変換される
  it('parseLines: converts invalid numbers to NaN', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',           // 正常
      '2025-01-03T10:13:00Z,u2,/b,invalid,200',       // 不正なステータス → NaN
      '2025-01-03T10:14:00Z,u3,/c,200,notNumber',     // 不正なレイテンシ → NaN
      '2025-01-03T10:15:00Z,u4,/d,200,150',           // 正常
    ]);
  
    expect(rows.length).toBe(4);              // 全ての行がパースされる
    expect(rows[0].status).toBe(200);         // 正常なステータス
    expect(rows[1].status).toBeNaN();         // 不正なステータスはNaN
    expect(rows[2].latencyMs).toBeNaN();      // 不正なレイテンシはNaN
    expect(rows[3].status).toBe(200);         // 正常なステータス
  });

  it.todo('aggregate basic');
});
