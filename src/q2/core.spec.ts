import { describe, expect, it } from 'vitest';
import { parseLines, aggregate } from './core.js';

describe('Q2 core - Parse', () => {
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
      'just,some,text',                           // カラム不足（3カラム）→ スキップ
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
});

  // 2. 期間フィルタ：from/to の境界含む / 範囲外除外
describe('Q2 core - Aggregate', () => {
  it('aggregate: includes both date boundaries', () => {
    const csvLines = [
      '2024-12-31T23:59:59Z,u0,/before,200,50',     // 範囲外(前)
      '2025-01-01T00:00:00Z,u1,/start,200,100',     // from境界 
      '2025-01-01T12:00:00Z,u2,/middle,200,150',    // 範囲内 
      '2025-01-03T23:59:59Z,u3,/end,200,200',       // to境界 
      '2025-01-04T00:00:00Z,u4,/after,200,250',     // 範囲外(後)
    ];

    const result = aggregate(csvLines, {
      from: '2025-01-01',
      to: '2025-01-03', 
      tz: 'jst',
      top: 10
    });
    
    // 結果に含まれるpathをチェック
    const paths = result.map(r => r.path);
    expect(paths).toContain('/start');       // from境界含む
    expect(paths).toContain('/middle');      // 範囲内
    expect(paths).toContain('/end');         // to境界含む
    expect(paths).not.toContain('/before');  // 範囲外除外
    expect(paths).not.toContain('/after');   // 範囲外除外

    expect(result.length).toBe(3);           // 有効な記録のみ
  });

  // 3. タイムゾーン：UTC→JST/ICT の変換で日付跨ぎが正しい
  // UTC -> JST: +9時間
  it('aggregate: UTC to JST timezone conversion crosses date', () => {
    const csvLines = [
      '2025-01-01T20:00:00Z,u1,/api/test,200,100',    // UTC 20:00 → JST 05:00 (翌日)
      '2025-01-01T14:00:00Z,u2,/api/test,200,200',    // UTC 14:00 → JST 23:00 (同日)
    ];

    const jstResult = aggregate(csvLines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 10
    });

    // JST変換により日付グルーピングが変わることを確認
    expect(jstResult.length).toBe(2);                 // 2つの日付に分かれる
    expect(jstResult[0].date).toBe('2025-01-01');     // 14:00のレコード(同日)
    expect(jstResult[1].date).toBe('2025-01-02');     // 20:00のレコード(翌日)
  });

  // UTC -> ICT: +7時間
  it('aggregate: UTC to ICT timezone conversion crosses date', () => {
    const csvLines = [
      '2025-01-01T17:00:00Z,u1,/api/test,200,100',    // UTC 17:00 → ICT 00:00 (翌日)
      '2025-01-01T10:00:00Z,u2,/api/test,200,200',    // UTC 10:00 → ICT 17:00 (同日)
    ];

    const ictResult = aggregate(csvLines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'ict',
      top: 10
    });

    // ICT変換により日付グルーピングが変わることを確認
    expect(ictResult.length).toBe(2);                 // 2つの日付に分かれる
    expect(ictResult[0].date).toBe('2025-01-01');     // 10:00のレコード(同日)
    expect(ictResult[1].date).toBe('2025-01-02');     // 17:00のレコード(翌日)
  });
  
  it.todo('aggregate basic');

});
