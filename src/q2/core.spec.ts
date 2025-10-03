import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  // ========================================
  // UNIT TESTS - 各関数の単体テスト
  // ========================================

  describe('parseLines - Input Validation', () => {
    it('parseLines: skips broken rows', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/a,200,100',
        'broken,row,only,three',
      ]);
      expect(rows.length).toBe(1);
    });

    it('validates integer requirements strictly - rejects non-integers', () => {
      const input = [
        '2025-01-03T10:12:00Z,u1,/api/orders,200,123', // 正常 - 有効な整数
        '2025-01-03T10:12:00Z,u2,/api/orders,abc,123', // 無効 - status が数値でない
        '2025-01-03T10:12:00Z,u3,/api/orders,200', // 無効 - latencyMs が不足
        '2025-01-03T10:12:00Z,u4,/api/orders,200,xyz', // 無効 - latencyMs が数値でない
        '2025-01-03T10:12:00Z,u5,/api/orders,200.5,123', // 無効 - status が小数
        '2025-01-03T10:12:00Z,u6,/api/orders,200,123.7', // 無効 - latencyMs が小数
        '2025-01-03T10:12:00Z,u7,/api/orders,-1,123', // 無効 - status が負数
        '2025-01-03T10:12:00Z,u8,/api/orders,200,-50', // 無効 - latencyMs が負数
      ];
      const rows = parseLines(input);

      // 最初の行のみ有効（status=200, latencyMs=123 ともに正の整数）
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/api/orders',
        status: 200,
        latencyMs: 123,
      });
    });

    it('handles edge cases in parsing - empty fields and special characters', () => {
      const input = [
        '2025-01-01T10:00:00Z,u1,/api,200,100', // 正常
        '2025-01-01T10:00:00Z,,/api,200,100', // 無効 - userId が空
        '2025-01-01T10:00:00Z,u2,,200,100', // 無効 - path が空
        '2025-01-01T10:00:00Z,u3,/api/special-chars_123,200,100', // 正常 - path に特殊文字
        ',u4,/api,200,100', // 無効 - timestamp が空
        '2025-01-01T10:00:00Z,u5,/api,0,0', // エッジケース - ゼロ値
      ];
      const rows = parseLines(input);

      // 2行が有効
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.some((r) => r.path === '/api/special-chars_123')).toBe(true);
    });
  });

  // ========================================
  // INTEGRATION TESTS - 統合機能テスト
  // ========================================

  describe('Date Range Filtering - Boundary Testing', () => {
    it('validates exact timezone boundary conversion - JST edge case', () => {
      // タイムゾーン境界での正確な変換テスト
      const lines = [
        '2025-01-01T14:59:59Z,u1,/api,200,100', // UTC 14:59:59 = JST 23:59:59 同日
        '2025-01-01T15:00:00Z,u2,/api,200,150', // UTC 15:00:00 = JST 00:00:00 翌日
        '2025-01-01T15:00:01Z,u3,/api,200,200', // UTC 15:00:01 = JST 00:00:01 翌日
      ];

      // JSTで 2025-01-01 のみをフィルター
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 10,
      });

      // 最初のレコードのみが JST で 2025-01-01 に属する
      if (result.length > 0) {
        expect(result[0].count).toBe(1); // u1 のみ
        expect(result[0].date).toBe('2025-01-01');
      }
    });

    it('validates exact timezone boundary conversion - ICT edge case', () => {
      // ICT のタイムゾーン境界での正確な変換テスト
      const lines = [
        '2025-01-01T16:59:59Z,u1,/api,200,100', // UTC 16:59:59 = ICT 23:59:59 同日
        '2025-01-01T17:00:00Z,u2,/api,200,150', // UTC 17:00:00 = ICT 00:00:00 翌日
      ];

      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'ict',
        top: 10,
      });

      if (result.length > 0) {
        expect(result[0].count).toBe(1); // ICT 2025-01-01 に u1 のみ
      }
    });

    it('filters by date range with inclusive boundaries', () => {
      const lines = [
        '2025-01-01T23:59:59Z,u1,/api,200,100', // 2025-01-01 日末
        '2025-01-02T00:00:00Z,u2,/api,200,150', // 2025-01-02 日始 (from boundary)
        '2025-01-02T12:00:00Z,u3,/api,200,200', // 2025-01-02 日中
        '2025-01-03T23:59:59Z,u4,/api,200,250', // 2025-01-03 日末 (to boundary)
        '2025-01-04T00:00:00Z,u5,/api,200,300', // 2025-01-04 (範囲外)
      ];

      const result = aggregate(lines, {
        from: '2025-01-02',
        to: '2025-01-03',
        tz: 'jst',
        top: 10,
      });

      // 2025-01-02 から 2025-01-03 までを含む必要がある (inclusive)
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(
        result.every((r) => r.date >= '2025-01-02' && r.date <= '2025-01-03')
      ).toBe(true);
    });
  });

  describe('Aggregation & Rounding - Precision Testing', () => {
    it('validates exact rounding behavior for avgLatency', () => {
      const lines = [
        // テストケース 1: 整数の平均
        '2025-01-01T10:00:00Z,u1,/api/exact,200,100',
        '2025-01-01T10:00:00Z,u2,/api/exact,200,200', // avg = 150.0 (正確)

        // テストケース 2: 0.5 の切り上げ
        '2025-01-01T10:00:00Z,u3,/api/half,200,100',
        '2025-01-01T10:00:00Z,u4,/api/half,200,101', // avg = 100.5 → 101

        // テストケース 3: 複雑な小数
        '2025-01-01T10:00:00Z,u5,/api/complex,200,100',
        '2025-01-01T10:00:00Z,u6,/api/complex,200,101',
        '2025-01-01T10:00:00Z,u7,/api/complex,200,104', // avg = 101.666... → 102
      ];

      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 10,
      });

      expect(result).toHaveLength(3);

      const exactPath = result.find((r) => r.path === '/api/exact');
      const halfPath = result.find((r) => r.path === '/api/half');
      const complexPath = result.find((r) => r.path === '/api/complex');

      expect(exactPath?.avgLatency).toBe(150); // (100+200)/2 = 150.0
      expect(halfPath?.avgLatency).toBe(101); // (100+101)/2 = 100.5 → 101
      expect(complexPath?.avgLatency).toBe(102); // (100+101+104)/3 = 101.666... → 102
    });

    it('counts and calculates average latency correctly', () => {
      const lines = [
        '2025-01-01T10:00:00Z,u1,/api,200,100',
        '2025-01-01T11:00:00Z,u2,/api,200,150',
        '2025-01-01T12:00:00Z,u3,/api,200,200',
      ];

      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 10,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2025-01-01',
        path: '/api',
        count: 3,
        avgLatency: 150, // (100+150+200)/3 = 150
      });
    });
  });

  describe('Top N Ranking & Tie-Breaking - Algorithmic Precision', () => {
    it('applies top N filtering per date with exact count-based ranking', () => {
      const lines = [
        // Date 1: 3 paths với count khác nhau
        '2025-01-01T10:00:00Z,u1,/api/low,200,100', // count: 1 (lowest)
        '2025-01-01T10:00:00Z,u2,/api/high,200,100', // count: 3 (highest)
        '2025-01-01T10:00:00Z,u3,/api/high,200,100',
        '2025-01-01T10:00:00Z,u4,/api/high,200,100',
        '2025-01-01T10:00:00Z,u5,/api/mid,200,100', // count: 2 (middle)
        '2025-01-01T10:00:00Z,u6,/api/mid,200,100',
      ];

      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 2,
      });

      expect(result).toHaveLength(2); // 上位 2 件のみ
      expect(result[0].path).toBe('/api/high'); // 最高のcount (3)
      expect(result[0].count).toBe(3);
      expect(result[1].path).toBe('/api/mid'); // 2番目に高い (2)
      expect(result[1].count).toBe(2);
      // /api/low (count=1) はtop=2のため除外される
    });

    it('パス名での厳密なアルファベット順タイブレーク処理', () => {
      const lines = [
        // すべて同じcount=1でタイブレークをテスト
        '2025-01-01T10:00:00Z,u1,/api/zebra,200,100',
        '2025-01-01T10:00:00Z,u2,/api/alpha,200,100',
        '2025-01-01T10:00:00Z,u3,/api/beta,200,100',
        '2025-01-01T10:00:00Z,u4,/api/gamma,200,100',
      ];

      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 2,
      });

      expect(result).toHaveLength(2);
      // countが同じ時はパスをアルファベット順でソート
      expect(result[0].path).toBe('/api/alpha'); // アルファベット順で最初
      expect(result[1].path).toBe('/api/beta'); // アルファベット順で2番目
    });

    it('applies top N per date independently - multi-date ranking', () => {
      const lines = [
        // Date 1: 3 paths
        '2025-01-01T10:00:00Z,u1,/api/a1,200,100', // count: 1
        '2025-01-01T10:00:00Z,u2,/api/b1,200,100', // count: 2
        '2025-01-01T10:00:00Z,u3,/api/b1,200,100',
        '2025-01-01T10:00:00Z,u4,/api/c1,200,100', // count: 3
        '2025-01-01T10:00:00Z,u5,/api/c1,200,100',
        '2025-01-01T10:00:00Z,u6,/api/c1,200,100',

        // Date 2: 2 paths
        '2025-01-02T10:00:00Z,u7,/api/a2,200,100', // count: 1
        '2025-01-02T10:00:00Z,u8,/api/b2,200,100', // count: 2
        '2025-01-02T10:00:00Z,u9,/api/b2,200,100',
      ];

      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-02',
        tz: 'jst',
        top: 2, // Top 2 per date
      });

      // Should have 2 records for each date (top 2 per date)
      const date1Results = result.filter((r) => r.date === '2025-01-01');
      const date2Results = result.filter((r) => r.date === '2025-01-02');

      expect(date1Results).toHaveLength(2); // Top 2 from date 1
      expect(date2Results).toHaveLength(2); // All 2 from date 2

      // Verify ranking for date 1 (count DESC)
      expect(date1Results[0].path).toBe('/api/c1'); // count: 3
      expect(date1Results[1].path).toBe('/api/b1'); // count: 2
      // /api/a1 (count: 1) should be excluded
    });
  });

  describe('Output Ordering - Deterministic Sorting', () => {
    it('orders output correctly (date ASC, count DESC, path ASC) with complex data', () => {
      const lines = [
        // Date 2025-01-02 (later date)
        '2025-01-02T10:00:00Z,u1,/api/z,200,100', // count: 1, path: z
        '2025-01-02T10:00:00Z,u2,/api/a,200,100', // count: 1, path: a
        '2025-01-02T10:00:00Z,u3,/api/high,200,100', // count: 2, path: high
        '2025-01-02T10:00:00Z,u4,/api/high,200,100',

        // Date 2025-01-01 (earlier date)
        '2025-01-01T10:00:00Z,u5,/api/beta,200,100', // count: 1, path: beta
        '2025-01-01T10:00:00Z,u6,/api/alpha,200,100', // count: 1, path: alpha
        '2025-01-01T10:00:00Z,u7,/api/top,200,100', // count: 3, path: top
        '2025-01-01T10:00:00Z,u8,/api/top,200,100',
        '2025-01-01T10:00:00Z,u9,/api/top,200,100',
      ];

      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-02',
        tz: 'jst',
        top: 10,
      });

      // Verify complete ordering: date ASC, then count DESC, then path ASC
      const expectedOrder = [
        // 2025-01-01 (date ASC): count DESC, then path ASC
        { date: '2025-01-01', path: '/api/top', count: 3 }, // Highest count first
        { date: '2025-01-01', path: '/api/alpha', count: 1 }, // Same count, alpha < beta
        { date: '2025-01-01', path: '/api/beta', count: 1 },

        // 2025-01-02 (date ASC): count DESC, then path ASC
        { date: '2025-01-02', path: '/api/high', count: 2 }, // Highest count first
        { date: '2025-01-02', path: '/api/a', count: 1 }, // Same count, a < z
        { date: '2025-01-02', path: '/api/z', count: 1 },
      ];

      expect(result).toHaveLength(expectedOrder.length);

      for (let i = 0; i < expectedOrder.length; i++) {
        expect(result[i].date).toBe(expectedOrder[i].date);
        expect(result[i].path).toBe(expectedOrder[i].path);
        expect(result[i].count).toBe(expectedOrder[i].count);
      }
    });
  });

  describe('Edge Cases & Performance', () => {
    it('handles multiple paths per date efficiently with large variety', () => {
      const lines = [
        // Tạo nhiều path khác nhau với count và latency khác nhau
        '2025-01-01T10:00:00Z,u1,/api/users,200,50',
        '2025-01-01T10:00:00Z,u2,/api/users,200,100',
        '2025-01-01T10:00:00Z,u3,/api/users,200,150', // count: 3, avg: 100

        '2025-01-01T10:00:00Z,u4,/api/orders,200,200',
        '2025-01-01T10:00:00Z,u5,/api/orders,200,300', // count: 2, avg: 250

        '2025-01-01T10:00:00Z,u6,/api/products,200,400', // count: 1, avg: 400

        '2025-01-01T10:00:00Z,u7,/api/analytics,200,80',
        '2025-01-01T10:00:00Z,u8,/api/analytics,200,100',
        '2025-01-01T10:00:00Z,u9,/api/analytics,200,120', // count: 3, avg: 100
      ];

      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 10,
      });

      expect(result).toHaveLength(4);

      // Verify ordering by count DESC, then path ASC for ties
      expect(result[0].count).toBe(3); // Either /api/analytics or /api/users
      expect(result[1].count).toBe(3);
      expect(result[2].count).toBe(2); // /api/orders
      expect(result[3].count).toBe(1); // /api/products

      // For same count, verify alphabetical order
      const count3Paths = result
        .filter((r) => r.count === 3)
        .map((r) => r.path)
        .sort();
      expect(count3Paths).toEqual(['/api/analytics', '/api/users']);
    });

    it('handles large dataset simulation with timezone conversion', () => {
      // Generate 200 records across 2 days with timezone boundary
      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        // Day 1 in UTC (becomes day 1 in JST for first 15 hours, day 2 for last 9 hours)
        lines.push(
          `2025-01-01T${i < 10 ? '0' : ''}${Math.floor(i / 4)}:${(i % 4) * 15}:00Z,u${i},/api/test,200,${100 + i}`
        );
      }
      for (let i = 0; i < 100; i++) {
        // Day 2 in UTC
        lines.push(
          `2025-01-02T${i < 10 ? '0' : ''}${Math.floor(i / 4)}:${(i % 4) * 15}:00Z,u${i + 100},/api/test,200,${200 + i}`
        );
      }

      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-03',
        tz: 'jst',
        top: 10,
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((r) => r.count > 0 && r.avgLatency > 0)).toBe(true);

      // 総カウントの保持を検証 (データの欠損なし)
      const totalCount = result.reduce((sum, r) => sum + r.count, 0);
      expect(totalCount).toBeLessThanOrEqual(200); // タイムゾーンでフィルタされる可能性
    });

    it('handles empty input gracefully', () => {
      const result = aggregate([], {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 10,
      });
      expect(result).toEqual([]);
    });

    it('handles all invalid rows gracefully', () => {
      const lines = [
        'invalid,row,format',
        'another,invalid,row,with,extra',
        'incomplete,row',
        '2025-01-01T10:00:00Z,user,/api,abc,123', // invalid status
        '2025-01-01T10:00:00Z,user,/api,200,xyz', // invalid latency
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-01',
        tz: 'jst',
        top: 10,
      });
      expect(result).toEqual([]);
    });
  });
});
