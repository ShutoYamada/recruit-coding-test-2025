import { describe, expect, it } from 'vitest';
import type { Row } from './core.js';
import { filterByDate, parseLines } from './core.js';
describe('Q2 Core Logic', () => {
  describe('parseLines', () => {
    it('should parse valid lines correctly', () => {
      // The responsibility of skipping the header lies with the calling `aggregate` function.
      // `parseLines` itself does not skip the header.
      const result = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:13:00Z,u2,/api/users,404,250',
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/api/orders',
        status: 200,
        latencyMs: 100,
      });
      expect(result[1]).toEqual({
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

    it('should skip the header line because its values are not numeric', () => {
      const rows = parseLines([
        'timestamp,userId,path,status,latencyMs', // header
      ]);
      // Skipped because 'status' and 'latencyMs' are not numbers.
      expect(rows).toHaveLength(0);
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

    it('should skip lines with missing required fields (empty strings)', () => {
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

  // You will add tests for other functions (filter, aggregate, etc.) here
  describe('filterByDate', () => {
    it('should correctly filter rows based on the inclusive UTC date range', () => {
      // 1. Arrange: Prepare sample data with boundary cases
      const sampleRows: Row[] = [
        // This row should be filtered out (before 'from')
        {
          timestamp: '2025-01-01T23:59:59Z',
          userId: 'u1',
          path: '/before',
          status: 200,
          latencyMs: 100,
        },
        // This row should be kept (exactly on the 'from' boundary)
        {
          timestamp: '2025-01-02T00:00:00Z',
          userId: 'u2',
          path: '/on-from',
          status: 200,
          latencyMs: 100,
        },
        // This row should be kept (inside the range)
        {
          timestamp: '2025-01-02T12:00:00Z',
          userId: 'u3',
          path: '/inside',
          status: 200,
          latencyMs: 100,
        },
        // This row should be kept (exactly on the 'to' boundary)
        {
          timestamp: '2025-01-03T23:59:59Z',
          userId: 'u4',
          path: '/on-to',
          status: 200,
          latencyMs: 100,
        },
        // This row should be filtered out (after 'to')
        {
          timestamp: '2025-01-04T00:00:00Z',
          userId: 'u5',
          path: '/after',
          status: 200,
          latencyMs: 100,
        },
      ];

      const fromDate = '2025-01-02';
      const toDate = '2025-01-03';

      // 2. Act: Call the function under test
      const result = filterByDate(sampleRows, fromDate, toDate);

      // 3. Assert: Verify the result
      // Expect that 3 rows will be kept
      expect(result).toHaveLength(3);

      // Check more specifically which rows were kept
      const keptUserIds = result.map((row) => row.userId);
      expect(keptUserIds).toEqual(['u2', 'u3', 'u4']);
    });
  });
});
