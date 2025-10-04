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

  // カラム不足の行はスキップされる
it('parseLines: skips rows with insufficient columns', () => {
  const rows = parseLines([
    '2025-01-03T10:12:00Z,u1,/a,200,100',       // 正常（5カラム）
    '2025-01-03T10:13:00Z,u2,/b,200',           // カラム不足（4カラム）→ スキップ
    '2025-01-03T10:14:00Z,u3,/c,200,150',       // 正常（5カラム）
    '2025-01-03T10:15:00Z,u4',                  // カラム不足（2カラム）→ スキップ
    '',                                         // 空行 → スキップ
    'just,some,text',                          // カラム不足（3カラム）→ スキップ
  ]);
  
  expect(rows.length).toBe(2);                // 正常な行のみ処理される
  
  // 有効な行をすべて検証
  expect(rows[0].userId).toBe('u1');          // 最初の正常な行
  expect(rows[0].path).toBe('/a');            
  expect(rows[0].status).toBe(200);           
  expect(rows[0].latencyMs).toBe(100);        
  
  expect(rows[1].userId).toBe('u3');          // 2番目の正常な行
  expect(rows[1].path).toBe('/c');            
  expect(rows[1].status).toBe(200);           
  expect(rows[1].latencyMs).toBe(150);        
  
  // スキップされた行は存在しないことを検証
  expect(rows[2]).toBeUndefined();            // 3番目の行は存在しない
  expect(rows[3]).toBeUndefined();            // 4番目の行は存在しない
  expect(rows[4]).toBeUndefined();            // 5番目の行は存在しない
  expect(rows[5]).toBeUndefined();            // 6番目の行は存在しない
});

  it.todo('aggregate basic');
});
