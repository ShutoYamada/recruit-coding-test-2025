/* eslint-disable max-lines-per-function */
import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
    ]);
    expect(rows.length).toBe(1);
  });

  it('should skip invalid rows with missing columns or non-numeric data', () => {
    // 不正な行（カラム不足、非数値）を含む入力データ
    const input = [
      '2025-01-03T10:00:00Z,u1,/api/users,200,100', // Valid
      '2025-01-03T11:00:00Z,u2,/api/products', // Broken: missing columns
      '2025-01-03T12:00:00Z,u3,/api/cart,200,invalid', // Broken: non-numeric latency
    ];
    const options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst' as const,
      top: 5,
    };

    // 集計関数を呼び出し
    const result = aggregate(input, options);

    // 期待される結果 (有効な行のみ)
    const expectedOutput = [
      { date: '2025-01-03', path: '/api/users', count: 1, avgLatency: 100 },
    ];

    // 結果を比較
    expect(result).toEqual(expectedOutput);
  });
  // --- [C2] 期間フィルタのテスト ---
  describe('Time-based Filtering', () => {
    it('should include boundary dates and exclude out-of-range data', () => {
      // 境界値と期間外のデータを含む入力
      const input = [
        '2025-01-10T00:00:00Z,u1,/api/A,200,100', // Included (start boundary)
        '2025-01-12T23:59:59Z,u2,/api/C,200,200', // Included (end boundary)
        '2025-01-09T23:59:59Z,u3,/api/D,200,300', // Excluded (before)
        '2025-01-13T00:00:00Z,u4,/api/E,200,400', // Excluded (after)
      ];
      const options = {
        from: '2025-01-10',
        to: '2025-01-12',
        tz: 'jst' as const,
        top: 5,
      };

      // 集計関数を呼び出し
      const result = aggregate(input, options);

      // 期待される結果 (期間内のデータのみ、ソート済み)
      const expectedOutput = [
        { date: '2025-01-10', path: '/api/A', count: 1, avgLatency: 100 },
        { date: '2025-01-13', path: '/api/C', count: 1, avgLatency: 200 },
      ];

      // 結果を比較
      expect(result).toEqual(expectedOutput);
    });
  });

  // --- [C3] タイムゾーン変換のテスト ---
  describe('Timezone Conversion', () => {
    it('should correctly handle date crossover for JST timezone', () => {
      // 日付をまたぐデータを含む入力
      const input = [
        '2025-01-03T14:59:59Z,u1,/api/before,200,100', // JSTでは2025-01-03
        '2025-01-03T15:00:00Z,u2,/api/after,200,200', // JSTでは2025-01-04
      ];
      const options = {
        from: '2025-01-01',
        to: '2025-01-31',
        tz: 'jst' as const,
        top: 5,
      };

      // 集計関数を呼び出し
      const result = aggregate(input, options);

      // 期待される結果 (日付が正しく変換され、ソート済み)
      const expectedOutput = [
        { date: '2025-01-03', path: '/api/before', count: 1, avgLatency: 100 },
        { date: '2025-01-04', path: '/api/after', count: 1, avgLatency: 200 },
      ];

      // 結果を比較
      expect(result).toEqual(expectedOutput);
    });
  });

  // --- [C4] 集計処理のテスト ---
  describe('Aggregation', () => {
    it('should correctly calculate count and rounded avgLatency', () => {
      // 同じパスで複数ログを持つ入力
      const input = [
        '2025-01-10T02:00:00Z,u6,/api/users,200,100',
        '2025-01-10T03:00:00Z,u7,/api/users,200,151',
      ];
      const options = {
        from: '2025-01-01',
        to: '2025-01-31',
        tz: 'jst' as const,
        top: 5,
      };

      // 集計関数を呼び出し
      const result = aggregate(input, options);

      // 期待される結果 (avgLatencyが四捨五入される)
      const expectedOutput = [
        { date: '2025-01-10', path: '/api/users', count: 2, avgLatency: 126 },
      ];

      // 結果を比較
      expect(result).toEqual(expectedOutput);
    });
  });

  // --- [C5] トップN件のランク付けテスト ---
  describe('Top N Ranking', () => {
    it('should rank top N items per day and break ties by path name', () => {
      // ランク付けとタイブレークをテストするための入力
      const input = [
        '2025-01-11T01:00:00Z,u1,/api/orders,200,100', // orders: count=3
        '2025-01-11T02:00:00Z,u2,/api/orders,200,100',
        '2025-01-11T03:00:00Z,u3,/api/orders,200,100',
        '2025-01-11T04:00:00Z,u4,/api/vips,200,100', // vips: count=2
        '2025-01-11T05:00:00Z,u5,/api/vips,200,100',
        '2025-01-11T06:00:00Z,u6,/api/cart,200,100', // cart: count=2 (vipsと同数)
        '2025-01-11T07:00:00Z,u7,/api/cart,200,100',
        '2025-01-11T08:00:00Z,u8,/api/users,200,100', // users: count=1
      ];
      const options = {
        from: '2025-01-01',
        to: '2025-01-31',
        tz: 'jst' as const,
        top: 2,
      };

      // 集計関数を呼び出し
      const result = aggregate(input, options);

      // 期待される結果 (トップ2件のみ、ソート済み)
      const expectedOutput = [
        { date: '2025-01-11', path: '/api/orders', count: 3, avgLatency: 100 },
        { date: '2025-01-11', path: '/api/cart', count: 2, avgLatency: 100 },
      ];

      // 結果を比較
      expect(result).toEqual(expectedOutput);
    });
  });

  // --- [C6] 最終的な出力順のテスト ---
  describe('Final Output Order', () => {
    it('should sort the final output by date (asc), count (desc), then path (asc)', () => {
      // 複数日にまたがるソート順テスト用の入力
      const input = [
        '2025-01-11T01:00:00Z,u1,/api/Z,200,100', // Day 2, count 1
        '2025-01-10T01:00:00Z,u2,/api/B,200,100', // Day 1, count 2
        '2025-01-10T02:00:00Z,u3,/api/B,200,100',
        '2025-01-10T03:00:00Z,u4,/api/A,200,100', // Day 1, count 1
      ];
      const options = {
        from: '2025-01-01',
        to: '2025-01-31',
        tz: 'jst' as const,
        top: 5,
      };

      // 集計関数を呼び出し
      const result = aggregate(input, options);

      // 期待される結果 (最終的なソート順)
      const expectedOutput = [
        { date: '2025-01-10', path: '/api/B', count: 2, avgLatency: 100 },
        { date: '2025-01-10', path: '/api/A', count: 1, avgLatency: 100 },
        { date: '2025-01-11', path: '/api/Z', count: 1, avgLatency: 100 },
      ];

      // 結果を比較
      expect(result).toEqual(expectedOutput);
    });
  });
});
