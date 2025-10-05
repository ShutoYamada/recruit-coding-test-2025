import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  // 1. パース：壊れた行をスキップ
  describe('parseLines', () => {
    it('skips broken rows with insufficient columns', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/a,200,100',
        'broken,row,only,three',
      ]);
      expect(rows.length).toBe(1);
      expect(rows[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/a',
        status: 200,
        latencyMs: 100,
      });
    });

    it('skips rows with empty fields', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/a,200,100',
        ',u2,/b,200,50', // empty timestamp
        '2025-01-03T11:00:00Z,,/c,200,75', // empty userId
      ]);
      expect(rows.length).toBe(1);
    });

    it('trims whitespace from fields', () => {
      const rows = parseLines([
        ' 2025-01-03T10:12:00Z , u1 , /api/test , 200 , 100 ',
      ]);
      expect(rows[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/api/test',
        status: 200,
        latencyMs: 100,
      });
    });

    it('parses numeric fields correctly', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/a,404,250',
      ]);
      expect(rows[0].status).toBe(404);
      expect(rows[0].latencyMs).toBe(250);
      expect(typeof rows[0].status).toBe('number');
      expect(typeof rows[0].latencyMs).toBe('number');
    });
  });

  // 2. 期間フィルタ：from/to の境界含む / 範囲外除外
  describe('filterByDate - boundary tests', () => {
    it('includes both from and to boundaries (UTC)', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100', // exactly from
        '2025-01-01T12:00:00Z,u2,/b,200,150',
        '2025-01-03T23:59:59Z,u3,/c,200,200', // exactly to
        '2025-01-04T00:00:00Z,u4,/d,200,250', // after to
        '2024-12-31T23:59:59Z,u5,/e,200,300', // before from
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-03',
        tz: 'jst',
        top: 10,
      });

      // Should include 3 records (from boundary, middle, to boundary)
      expect(result.length).toBe(3);
      expect(result.find(r => r.path === '/a')).toBeDefined();
      expect(result.find(r => r.path === '/c')).toBeDefined();
      expect(result.find(r => r.path === '/d')).toBeUndefined(); // after to
      expect(result.find(r => r.path === '/e')).toBeUndefined(); // before from
    });

    it('excludes records outside date range', () => {
      const lines = [
        '2024-12-31T23:59:59Z,u1,/a,200,100',
        '2025-01-01T00:00:00Z,u2,/b,200,150',
        '2025-01-02T12:00:00Z,u3,/c,200,200',
        '2025-01-03T23:59:59Z,u4,/d,200,250',
        '2025-01-04T00:00:00Z,u5,/e,200,300',
      ];
      const result = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-03',
        tz: 'jst',
        top: 10,
      });

      expect(result.every(r => r.path !== '/a')).toBe(true); // before range
      expect(result.every(r => r.path !== '/e')).toBe(true); // after range
    });
  });
});
