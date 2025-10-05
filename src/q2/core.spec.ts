import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 CSV パース機能', () => {
  it('正常なCSV行を適切にパース', () => {
    const rows = parseLines(['2025-01-03T10:12:00Z,u1,/api/orders,200,120']);
    expect(rows[0]).toEqual({
      timestamp: '2025-01-03T10:12:00Z',
      userId: 'u1',
      path: '/api/orders',
      status: 200,
      latencyMs: 120,
    });
  });

  it('壊れた行をスキップ（カラム不足/空フィールド/空行）', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/api/orders,200,120', // 正常
      'broken,row,only,three', // カラム不足
      '2025-01-04T11:30:00Z,u2,/api/users,abc,90', // 正常（status文字列もNumber()で変換）
      '2025-01-05T12:00:00Z,u3,/api/items,200,xyz', // 正常（latency文字列もNumber()で変換）
      '',
      '   ', // 空行・空白行
      '2025-01-06T13:00:00Z,,/api/empty,200,100', // userId空
    ]);
    expect(rows).toHaveLength(3); // 正常な行が3つ（u1, u2, u3）
    expect(rows[0].userId).toBe('u1');
    expect(rows[1].userId).toBe('u2');
    expect(rows[2].userId).toBe('u3');
    expect(rows[1].status).toBeNaN(); // 'abc' -> NaN
    expect(rows[2].latencyMs).toBeNaN(); // 'xyz' -> NaN
  });
});

describe('Q2 期間フィルタ機能', () => {
  it('from/to境界含む判定が正しい', () => {
    const lines = [
      '2024-12-31T23:59:59Z,u1,/api/before,200,100', // 除外
      '2025-01-01T00:00:00Z,u2,/api/start,200,110', // 含む
      '2025-01-02T12:00:00Z,u3,/api/middle,200,120', // 含む
      '2025-01-03T23:59:59Z,u4,/api/end,200,130', // 含む
      '2025-01-04T00:00:00Z,u5,/api/after,200,140', // 除外
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-03',
      tz: 'jst',
      top: 10,
    });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.path)).toEqual([
      '/api/start',
      '/api/middle',
      '/api/end',
    ]);
  });
});

describe('Q2 タイムゾーン変換機能', () => {
  it('UTC→JST/ICT変換で日付跨ぎが正しい', () => {
    const lines = ['2025-01-01T15:30:00Z,u1,/api/test,200,100']; // UTC 15:30
    const jstResult = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 10,
    });
    const ictResult = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'ict',
      top: 10,
    });
    expect(jstResult[0].date).toBe('2025-01-02'); // JST: 00:30+1日
    expect(ictResult[0].date).toBe('2025-01-01'); // ICT: 22:30同日
  });
});

describe('Q2 集計機能', () => {
  it('date×pathの件数・平均が正しい', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/orders,200,100',
      '2025-01-01T11:00:00Z,u2,/api/orders,200,200',
      '2025-01-01T12:00:00Z,u3,/api/users,200,150',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-01',
      tz: 'jst',
      top: 10,
    });
    const orders = result.find((r) => r.path === '/api/orders')!;
    const users = result.find((r) => r.path === '/api/users')!;
    expect(orders.count).toBe(2);
    expect(orders.avgLatency).toBe(150); // (100+200)/2=150
    expect(users.count).toBe(1);
    expect(users.avgLatency).toBe(150);
  });
});

describe('Q2 ランキング機能', () => {
  it('日付ごとにcount降順、同数時はpath昇順', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/c,200,100',
      '2025-01-01T10:00:00Z,u2,/api/a,200,100',
      '2025-01-01T10:00:00Z,u3,/api/a,200,100', // count=2
      '2025-01-01T10:00:00Z,u4,/api/b,200,100', // count=1
      '2025-01-02T10:00:00Z,u5,/api/z,200,100',
      '2025-01-02T10:00:00Z,u6,/api/y,200,100',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 2,
    });
    // 各日付でtop2、最終順序：date ASC, count DESC, path ASC
    expect(
      result.map((r) => ({ date: r.date, path: r.path, count: r.count }))
    ).toEqual([
      { date: '2025-01-01', path: '/api/a', count: 2 }, // count降順1位
      { date: '2025-01-01', path: '/api/b', count: 1 }, // count降順2位（path昇順でb<c）
      { date: '2025-01-02', path: '/api/y', count: 1 }, // path昇順
      { date: '2025-01-02', path: '/api/z', count: 1 },
    ]);
  });
});

describe('Q2 統合テスト', () => {
  it('最終出力順序が決定的（date ASC, count DESC, path ASC）', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/api/z,200,100', // 2025-01-03, count=1
      '2025-01-01T10:00:00Z,u2,/api/b,200,100', // 2025-01-01, count=1
      '2025-01-01T10:00:00Z,u3,/api/a,200,100', // 2025-01-01, count=2
      '2025-01-01T10:00:00Z,u4,/api/a,200,100',
      '2025-01-02T10:00:00Z,u5,/api/x,200,100', // 2025-01-02, count=1
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-03',
      tz: 'jst',
      top: 10,
    });
    expect(
      result.map((r) => ({ date: r.date, path: r.path, count: r.count }))
    ).toEqual([
      { date: '2025-01-01', path: '/api/a', count: 2 }, // 日付1位、件数1位
      { date: '2025-01-01', path: '/api/b', count: 1 }, // 日付1位、件数2位
      { date: '2025-01-02', path: '/api/x', count: 1 }, // 日付2位
      { date: '2025-01-03', path: '/api/z', count: 1 }, // 日付3位
    ]);
  });
});

describe('Q2 エッジケース', () => {
  it('特殊文字・Unicode・丸め計算精度', () => {
    const lines = [
      '2025-01-01T10:00:00Z,user123,/api/測試,200,101', // Unicode文字
      '2025-01-01T11:00:00Z,user456,/api/測試,200,102', // 同path
      '2025-01-01T12:00:00Z,あいう,/api/special-@#$,404,300', // 特殊文字
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-01',
      tz: 'jst',
      top: 5,
    });
    const unicode = result.find((r) => r.path === '/api/測試')!;
    const special = result.find((r) => r.path === '/api/special-@#$')!;
    expect(unicode.count).toBe(2);
    expect(unicode.avgLatency).toBe(102); // Math.round((101+102)/2) = 102
    expect(special.count).toBe(1);
    expect(special.avgLatency).toBe(300);
  });

  it('top=0とtop=1の境界値', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/a,200,100',
      '2025-01-01T11:00:00Z,u2,/api/b,200,200',
      '2025-01-01T12:00:00Z,u3,/api/c,200,300',
    ];
    const zeroResult = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-01',
      tz: 'jst',
      top: 0,
    });
    const oneResult = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-01',
      tz: 'jst',
      top: 1,
    });
    expect(zeroResult).toHaveLength(0); // top=0なら空配列
    expect(oneResult).toHaveLength(1); // top=1なら1件のみ
    expect(oneResult[0].path).toBe('/api/a'); // 最初の1件（count同数時path昇順）
  });
});

describe('Q2 エラーハンドリング', () => {
  it('空配列・データなしケース', () => {
    const emptyResult = aggregate([], {
      from: '2025-01-01',
      to: '2025-01-01',
      tz: 'jst',
      top: 5,
    });
    expect(emptyResult).toHaveLength(0);

    const noMatchResult = aggregate(
      ['2025-01-01T10:00:00Z,u1,/api/test,200,100'],
      {
        from: '2025-12-01',
        to: '2025-12-31',
        tz: 'jst',
        top: 5,
      }
    );
    expect(noMatchResult).toHaveLength(0); // 期間外データのみ
  });

  it('同一秒の複数リクエスト・ソート安定性', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/z,200,100', // 同時刻
      '2025-01-01T10:00:00Z,u2,/api/a,200,100', // 同時刻
      '2025-01-01T10:00:00Z,u3,/api/m,200,100', // 同時刻
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-01',
      tz: 'jst',
      top: 10,
    });
    expect(result.map((r) => r.path)).toEqual(['/api/a', '/api/m', '/api/z']); // path昇順安定
    expect(result.every((r) => r.count === 1 && r.avgLatency === 100)).toBe(
      true
    );
  });
});

describe('Q2 特殊ケース第2弾', () => {
  it('極端な数値・負数・非常に大きなlatency', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/test,200,0', // latency=0
      '2025-01-01T11:00:00Z,u2,/api/test,200,999999', // 非常に大きなlatency
      '2025-01-01T12:00:00Z,u3,/api/error,-404,150', // 負のstatus
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-01',
      tz: 'jst',
      top: 5,
    });
    const testApi = result.find((r) => r.path === '/api/test')!;
    const errorApi = result.find((r) => r.path === '/api/error')!;
    expect(testApi.count).toBe(2);
    expect(testApi.avgLatency).toBe(500000); // Math.round((0+999999)/2)
    expect(errorApi.count).toBe(1);
    expect(errorApi.avgLatency).toBe(150);
  });

  it('midnight境界・タイムゾーン跨ぎ詳細', () => {
    const lines = [
      '2025-01-01T14:59:59Z,u1,/api/before,200,100', // JST 23:59:59 (2025-01-01)
      '2025-01-01T15:00:00Z,u2,/api/exactly,200,200', // JST 00:00:00 (2025-01-02)
      '2025-01-01T15:00:01Z,u3,/api/after,200,300', // JST 00:00:01 (2025-01-02)
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 5,
    });
    expect(result).toHaveLength(3);
    expect(result.filter((r) => r.date === '2025-01-01')).toHaveLength(1); // before
    expect(result.filter((r) => r.date === '2025-01-02')).toHaveLength(2); // exactly, after
  });

  it('大量同一pathランキング・安定ソート', () => {
    const lines = Array.from(
      { length: 50 },
      (_, i) =>
        `2025-01-01T${String(10 + Math.floor(i / 10)).padStart(2, '0')}:${String((i % 10) * 6).padStart(2, '0')}:00Z,u${i},/api/bulk,200,${100 + i}`
    );
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-01',
      tz: 'jst',
      top: 10,
    });
    expect(result).toHaveLength(1); // 1つのpathのみ
    expect(result[0].path).toBe('/api/bulk');
    expect(result[0].count).toBe(50);
    expect(result[0].avgLatency).toBe(125); // Math.round((100+149)/2) = Math.round(124.5) = 125
  });
});
