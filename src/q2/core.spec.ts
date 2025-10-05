import { describe, expect, it } from 'vitest';
import { parseLines } from './core.js';

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
});
