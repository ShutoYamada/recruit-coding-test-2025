import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  // 既存のテストは維持
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three', // カラム不足
      '2025-01-03T10:13:00Z,u2,/b,not_a_number,120', // statusが数値でない
      '2025-01-03T10:14:00Z,u3,/c,500,not_a_number', // latencyが数値でない
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].path).toBe('/a');
  });

  // aggregate関数のための新しいテストスイート
  describe('aggregate', () => {
    // 多くのケースをカバーするテストデータ
    const testData = [
      'timestamp,userId,path,status,latencyMs',
      // 期間外のデータ（フィルタリングで除外される）
      '2024-12-31T23:59:59Z,u0,/api/before,200,100',
      '2025-02-01T00:00:00Z,u0,/api/after,200,100',

      // 2025-01-15 (JST) のデータ
      // UTC 2025-01-14 14:59:59 -> JST 2025-01-14 23:59:59 (まだ14日)
      '2025-01-14T14:59:59Z,u1,/api/users,200,80',
      // UTC 2025-01-14 15:00:00 -> JST 2025-01-15 00:00:00 (日付が変わる)
      '2025-01-14T15:00:00Z,u1,/api/users,200,100',
      '2025-01-14T16:00:00Z,u2,/api/users,200,120', // avg: (100+120)/2 = 110

      // 2025-01-16 (JST) のデータ
      '2025-01-15T15:00:00Z,u3,/api/products,200,200',
      '2025-01-15T15:01:00Z,u4,/api/products,200,250', // count=3, avg=225
      '2025-01-15T15:02:00Z,u5,/api/products,500,225',
      '2025-01-15T16:00:00Z,u6,/api/orders,200,150', // count=2
      '2025-01-15T16:01:00Z,u7,/api/orders,200,160', // avg=155
      '2025-01-15T17:00:00Z,u8,/api/cart,200,50', // count=1
      // 同数時の順序決定（タイブレーク）をテストするためのデータ
      '2025-01-15T18:00:00Z,u9,/api/b_path,200,100', // count=2
      '2025-01-15T18:01:00Z,u10,/api/b_path,200,100',
      '2025-01-15T18:02:00Z,u11,/api/a_path,200,100', // count=2
      '2025-01-15T18:03:00Z,u12,/api/a_path,200,100',
    ];

    it('should filter, group, rank, and sort correctly with top=2', () => {
      const result = aggregate(testData, {
        from: '2025-01-01',
        to: '2025-01-31',
        tz: 'jst',
        top: 2,
      });

      // 結果の総数を確認
      // 15日: /api/users (count=2)
      // 16日: /api/products (count=3), /api/a_path (count=2) -> top 2
      expect(result.length).toBe(3);

      // --- 最終的なソート順を確認 ---
      // 1. 2025-01-15
      expect(result[0].date).toBe('2025-01-15');
      expect(result[0].path).toBe('/api/users');
      expect(result[0].count).toBe(2);
      expect(result[0].avgLatency).toBe(110);

      // 2. 2025-01-16
      // /api/products が count=3 で最多
      expect(result[1].date).toBe('2025-01-16');
      expect(result[1].path).toBe('/api/products');
      expect(result[1].count).toBe(3);
      expect(result[1].avgLatency).toBe(225);

      // 3. 2025-01-16, top 2
      // /api/a_path と /api/b_path は両方とも count=2 だが、/api/a_path が先にくる
      expect(result[2].date).toBe('2025-01-16');
      expect(result[2].path).toBe('/api/a_path');
      expect(result[2].count).toBe(2);
      expect(result[2].avgLatency).toBe(100);

      // /api/b_path と /api/orders も count=2 だが、アルファベット順で /api/a_path が優先される
      // /api/cart は count=1 なので top=2 によって除外される
    });

    it('should return empty array if no data in range', () => {
      const result = aggregate(testData, {
        from: '2023-01-01',
        to: '2023-12-31',
        tz: 'jst',
        top: 5,
      });
      expect(result).toEqual([]);
    });
  });
});

