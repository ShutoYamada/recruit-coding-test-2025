import { describe, expect, it } from 'vitest';
import { parseLines } from './core.js';

describe('Q2 core', () => {
  describe('parseLines', () => {
    it('should parse valid lines correctly', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:13:00Z,u2,/api/users,404,250',
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/api/orders',
        status: 200,
        latencyMs: 100,
      });
      expect(rows[1]).toEqual({
        timestamp: '2025-01-03T10:13:00Z',
        userId: 'u2',
        path: '/api/users',
        status: 404,
        latencyMs: 250,
      });
    });

    it('should skip lines with insufficient fields', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100', // valid
        'broken,row,only,three', // only 4 fields
        'incomplete,line', // only 2 fields
        'single', // only 1 field
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe('u1');
    });

    it('should skip lines with non-numeric status or latencyMs', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100', // valid
        '2025-01-03T10:13:00Z,u2,/api/users,invalid,250', // invalid status
        '2025-01-03T10:14:00Z,u3,/api/orders,200,invalid', // invalid latency
        '2025-01-03T10:15:00Z,u4,/api/users,abc,def', // both invalid
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe('u1');
    });

    it('should skip header line', () => {
      const rows = parseLines([
        'timestamp,userId,path,status,latencyMs', // header
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100', // valid data
        '2025-01-03T10:13:00Z,u2,/api/users,404,250', // valid data
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0].userId).toBe('u1');
      expect(rows[1].userId).toBe('u2');
    });

    it('should skip empty and whitespace-only lines', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100', // valid
        '', // empty line
        '   ', // whitespace only
        '2025-01-03T10:13:00Z,u2,/api/users,404,250', // valid
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0].userId).toBe('u1');
      expect(rows[1].userId).toBe('u2');
    });

    it('should trim whitespace from fields', () => {
      const rows = parseLines([
        ' 2025-01-03T10:12:00Z , u1 , /api/orders , 200 , 100 ',
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/api/orders',
        status: 200,
        latencyMs: 100,
      });
    });

    it('should skip lines with missing required fields', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100', // valid
        ',u2,/api/users,404,250', // missing timestamp
        '2025-01-03T10:13:00Z,,/api/orders,200,150', // missing userId
        '2025-01-03T10:14:00Z,u3,,404,200', // missing path
        '2025-01-03T10:15:00Z,u4,/api/users,,300', // missing status
        '2025-01-03T10:16:00Z,u5,/api/orders,200,', // missing latencyMs
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe('u1');
    });
  });

  it.todo('aggregate basic');
});
