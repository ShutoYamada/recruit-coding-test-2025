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

describe('Q2 core - Aggregate', () => {
  // 2. 期間フィルタ：from/to の境界含む / 範囲外除外
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
});

 
describe('Q2 core - Aggregation Logic', () => {
  // 4. 集計：date×path の件数・平均が合う
  it('aggregate: date and path grouping with count and avgLatency', () => {
    const csvLines = [
      '2025-01-01T10:00:00Z,u1,/api/orders,200,100',   // 2025-01-01 /api/orders
      '2025-01-01T11:00:00Z,u2,/api/orders,200,200',   // 2025-01-01 /api/orders
      '2025-01-01T12:00:00Z,u3,/api/users,200,150',    // 2025-01-01 /api/users
      '2025-01-02T10:00:00Z,u4,/api/orders,200,300',   // 2025-01-02 /api/orders
      '2025-01-02T11:00:00Z,u5,/api/orders,500,400',   // 2025-01-02 /api/orders (異なるステータス)
    ];

    const result = aggregate(csvLines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 10
    });

    // 結果の検証
    expect(result.length).toBe(3);                    // 3つのグループ

    // 2025-01-01 /api/orders: count=2, avgLatency=(100+200)/2=150
    const group1 = result.find(r => r.date === '2025-01-01' && r.path === '/api/orders');
    expect(group1).toBeDefined();
    expect(group1!.count).toBe(2);                    // Non-null assertion
    expect(group1!.avgLatency).toBe(150);

    // 2025-01-01 /api/users: count=1, avgLatency=150
    const group2 = result.find(r => r.date === '2025-01-01' && r.path === '/api/users');
    expect(group2).toBeDefined();
    expect(group2!.count).toBe(1);                    // Non-null assertion
    expect(group2!.avgLatency).toBe(150);

    // 2025-01-02 /api/orders: count=2, avgLatency=(300+400)/2=350
    const group3 = result.find(r => r.date === '2025-01-02' && r.path === '/api/orders');
    expect(group3).toBeDefined();
    expect(group3!.count).toBe(2);                    // Non-null assertion
    expect(group3!.avgLatency).toBe(350);
  });

  // 5. 上位N：count降順、path昇順で日付ごとにtop制限
  it('aggregate: top N ranking per date with count desc, path asc', () => {
    const csvLines = [
      // 2025-01-01: 4 paths
      '2025-01-01T10:00:00Z,u1,/api/orders,200,100',   // JST: 2025-01-01 19:00
      '2025-01-01T11:00:00Z,u2,/api/orders,200,200',   // JST: 2025-01-01 20:00
      '2025-01-01T12:00:00Z,u3,/api/orders,200,150',   // JST: 2025-01-01 21:00
      '2025-01-01T13:00:00Z,u4,/api/users,200,120',    // JST: 2025-01-01 22:00
      '2025-01-01T14:00:00Z,u5,/api/users,200,180',    // JST: 2025-01-01 23:00
      '2025-01-01T15:00:00Z,u6,/api/products,200,90',  // JST: 2025-01-02 00:00 (翌日)
      '2025-01-01T16:00:00Z,u7,/api/products,200,110', // JST: 2025-01-02 01:00 (翌日)
      '2025-01-01T17:00:00Z,u8,/api/auth,200,50',      // JST: 2025-01-02 02:00 (翌日)
      
      // 2025-01-02: 3 paths  
      '2025-01-02T10:00:00Z,u9,/api/orders,200,200',   // JST: 2025-01-02 19:00
      '2025-01-02T11:00:00Z,u10,/api/users,200,150',   // JST: 2025-01-02 20:00
      '2025-01-02T12:00:00Z,u11,/api/auth,200,100',    // JST: 2025-01-02 21:00
    ];

    const result = aggregate(csvLines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 2  // 各日付でtop 2のみ
    });

    // 結果の検証
    expect(result.length).toBe(4);  // 2日 × top2 = 4 records

    // 2025-01-01の結果をチェック (JST変換後)
    const date1Results = result.filter(r => r.date === '2025-01-01');
    expect(date1Results.length).toBe(2);
    expect(date1Results[0].path).toBe('/api/orders');     // count=3が最高
    expect(date1Results[0].count).toBe(3);
    expect(date1Results[1].path).toBe('/api/users');      // count=2でpath昇順
    expect(date1Results[1].count).toBe(2);

    // 2025-01-02の結果をチェック (JST変換後)
    const date2Results = result.filter(r => r.date === '2025-01-02');
    expect(date2Results.length).toBe(2);
    expect(date2Results[0].path).toBe('/api/auth');       // count=2でpath昇順 (auth < products)
    expect(date2Results[0].count).toBe(2);
    expect(date2Results[1].path).toBe('/api/products');   // count=2でpath昇順
    expect(date2Results[1].count).toBe(2);
  });

  
  it.todo('aggregate basic');

});
