import { describe, expect, it } from 'vitest';
import { aggregate, parseLines, type Options } from './core.js';

/**
 * Q2 core tests
 * - 日本語コメントを各 describe/it に追加しています
 * - テストは仕様（パース/期間フィルタ/TZ変換/集計/TopN/出力順）に基づく
 */

describe('Q2 core', () => {
  // ========================================
  // 1. Parse Tests - 壊れた行のスキップ / Parse: skip broken rows
  // ========================================
  describe('parseLines (パース)', () => {
    it('should parse valid CSV lines correctly', () => {
      const lines = [
        '2025-01-03T10:12:00Z,u1,/api/orders,200,123',
        '2025-01-03T11:30:00Z,u2,/api/users,404,50',
      ];
      const rows = parseLines(lines);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/api/orders',
        status: 200,
        latencyMs: 123,
      });
      expect(rows[1]).toEqual({
        timestamp: '2025-01-03T11:30:00Z',
        userId: 'u2',
        path: '/api/users',
        status: 404,
        latencyMs: 50,
      });
    });

    it('should skip rows with missing columns', () => {
      const lines = [
        '2025-01-03T10:12:00Z,u1,/a,200,100',
        'broken,row,only,three', // 4 columns only -> skip
        '2025-01-03T10:13:00Z,u2,/b,200,200',
        'only,two', // 2 columns -> skip
        '', // empty line -> skip
      ];
      const rows = parseLines(lines);

      expect(rows).toHaveLength(2);
      expect(rows[0].path).toBe('/a');
      expect(rows[1].path).toBe('/b');
    });

    it('should trim whitespace from fields', () => {
      const lines = [
        ' 2025-01-03T10:12:00Z , u1 , /api/test , 200 , 100 ',
      ];
      const rows = parseLines(lines);

      expect(rows).toHaveLength(1);
      expect(rows[0].timestamp).toBe('2025-01-03T10:12:00Z');
      expect(rows[0].userId).toBe('u1');
      expect(rows[0].path).toBe('/api/test');
      expect(rows[0].status).toBe(200);
      expect(rows[0].latencyMs).toBe(100);
    });

    it('should skip rows where status or latency are non-numeric', () => {
      const lines = [
        '2025-01-03T10:12:00Z,u1,/a,200,100',      // valid
        '2025-01-03T10:13:00Z,u2,/b,OK,200',       // status non-numeric -> skip (expected by spec)
        '2025-01-03T10:14:00Z,u3,/c,200,NaN',      // latency non-numeric -> skip (expected by spec)
        '2025-01-03T10:15:00Z,u4,/d,404,50',       // valid
      ];
      const rows = parseLines(lines);

      // NOTE: parseLines in core.ts currently only checks presence of fields.
      // Spec requires skipping non-numeric; if core.ts not updated, this test will fail,
      // indicating core.ts needs to validate numeric conversion.
      // Here we assert expected behavior per spec.
      expect(rows.map(r => r.path)).toEqual(['/a', '/d']);
    });
  });
});
