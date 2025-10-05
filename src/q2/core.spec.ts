import { describe, expect, it } from 'vitest';
import { aggregate, filterByDate, groupByDatePath, parseLines, rankTop, toTZDate } from './core.js';

describe('Q2 core', () => {
  // ------------------------------
  // parseLines: 壊れた行をスキップ、データをトリム
  // ------------------------------
  it('parseLines: 壊れた行をスキップしデータをトリム', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z, u1 , /a ,200,100 ',
      'broken,row,only,three',
      '2025-01-03T10:13:00Z,u2,/b,200,200',
      '2025-01-03T10:14:00Z,u3,/c,abc,100',
      '2025-01-03T10:15:00Z,u4,/d,200,def',
    ]);
    expect(rows).toEqual([
      { timestamp: '2025-01-03T10:12:00Z', userId: 'u1', path: '/a', status: 200, latencyMs: 100 },
      { timestamp: '2025-01-03T10:13:00Z', userId: 'u2', path: '/b', status: 200, latencyMs: 200 },
    ]);
  });

  // ------------------------------
  // filterByDate: 境界を含む（from/to 正しい）
  // ------------------------------
  it('filterByDate: fromとtoの境界を含む', () => {
    const rows = [
      { timestamp: '2025-01-01T00:00:00Z', userId: 'u1', path: '/a', status: 200, latencyMs: 100 },
      { timestamp: '2025-01-02T23:59:59Z', userId: 'u2', path: '/a', status: 200, latencyMs: 100 },
      { timestamp: '2024-12-31T23:59:59Z', userId: 'u3', path: '/a', status: 200, latencyMs: 100 },
      { timestamp: '2025-01-03T00:00:00Z', userId: 'u4', path: '/a', status: 200, latencyMs: 100 },
    ];
    const filtered = filterByDate(rows, '2025-01-01', '2025-01-02');
    expect(filtered.length).toBe(2);
  });

  // ------------------------------
  // toTZDate: UTC+7とUTC+9をチェック
  // ------------------------------
  it('toTZDate: UTCをJST（UTC+9）に変換', () => {
    expect(toTZDate('2025-01-02T15:00:00Z', 'jst')).toBe('2025-01-03');
  });

  it('toTZDate: UTCをICT（UTC+7）に変換', () => {
    expect(toTZDate('2025-01-02T17:00:00Z', 'ict')).toBe('2025-01-03');
  });

  // ------------------------------
  // groupByDatePath: count, avgLatency = 正しく丸め
  // ------------------------------
  it('groupByDatePath: countとavgLatencyを正しく計算・丸め', () => {
    const rows = [
      { timestamp: '2025-01-03T10:00:00Z', userId: 'u1', path: '/a', status: 200, latencyMs: 100 },
      { timestamp: '2025-01-03T10:00:00Z', userId: 'u2', path: '/a', status: 200, latencyMs: 200 },
      { timestamp: '2025-01-03T10:00:00Z', userId: 'u3', path: '/b', status: 200, latencyMs: 150 },
      { timestamp: '2025-01-03T10:00:00Z', userId: 'u4', path: '/c', status: 200, latencyMs: 0 },
      { timestamp: '2025-01-03T10:00:00Z', userId: 'u5', path: '/c', status: 200, latencyMs: 1 },
    ];
    const grouped = groupByDatePath(rows, 'jst');
    expect(grouped).toEqual([
      { date: '2025-01-03', path: '/a', count: 2, avgLatency: 150 },
      { date: '2025-01-03', path: '/b', count: 1, avgLatency: 150 },
      { date: '2025-01-03', path: '/c', count: 2, avgLatency: 1 },
    ]);
  });

  // ------------------------------
  // rankTop: top Nを保持、tie-breakはpath ASC
  // ------------------------------
  it('rankTop: 日付ごとにtop Nを保持、tie-breakはpath ASC', () => {
    const items = [
      { date: '2025-01-03', path: '/api/a', count: 2, avgLatency: 100 },
      { date: '2025-01-03', path: '/api/b', count: 1, avgLatency: 100 },
      { date: '2025-01-03', path: '/api/c', count: 1, avgLatency: 100 },
      { date: '2025-01-04', path: '/api/d', count: 1, avgLatency: 100 },
    ];
    const ranked = rankTop(items, 2);
    expect(ranked).toEqual([
      { date: '2025-01-03', path: '/api/a', count: 2, avgLatency: 100 },
      { date: '2025-01-03', path: '/api/b', count: 1, avgLatency: 100 },
      { date: '2025-01-04', path: '/api/d', count: 1, avgLatency: 100 },
    ]);
  });

  // ------------------------------
  // aggregate 総合
  // ------------------------------
  it('aggregate: サンプルケースをテスト', () => {
    const lines = [
      '2025-01-03T10:12:00Z,u42,/api/orders,200,123',
      '2025-01-03T10:13:00Z,u43,/api/orders,200,456',
      '2025-01-04T10:14:00Z,u44,/api/users,200,789',
    ];
    const result = aggregate(lines, { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 3 });
    expect(result).toEqual([
      { date: '2025-01-03', path: '/api/orders', count: 2, avgLatency: 290 },
      { date: '2025-01-04', path: '/api/users', count: 1, avgLatency: 789 },
    ]);
  });

  it('aggregate: 空入力', () => {
    const result = aggregate([], { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 5 });
    expect(result).toEqual([]);
  });

  it('aggregate: 複数パスでcount tie', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/api/a,200,100',
      '2025-01-03T10:00:00Z,u2,/api/b,200,100',
      '2025-01-03T10:00:00Z,u3,/api/c,200,100',
    ];
    const result = aggregate(lines, { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 2 });
    expect(result).toEqual([
      { date: '2025-01-03', path: '/api/a', count: 1, avgLatency: 100 },
      { date: '2025-01-03', path: '/api/b', count: 1, avgLatency: 100 },
    ]);
  });

  it('aggregate: 出力順固定（date ASC, count DESC, path ASC）', () => {
    const lines = [
      '2025-01-02T10:00:00Z,u1,/api/z,200,100',
      '2025-01-01T10:00:00Z,u2,/api/a,200,100',
      '2025-01-01T10:00:00Z,u3,/api/a,200,100',
    ];
    const result = aggregate(lines, { from: '2025-01-01', to: '2025-01-31', tz: 'jst', top: 5 });
    expect(result).toEqual([
      { date: '2025-01-01', path: '/api/a', count: 2, avgLatency: 100 },
      { date: '2025-01-02', path: '/api/z', count: 1, avgLatency: 100 },
    ]);
  });
});
