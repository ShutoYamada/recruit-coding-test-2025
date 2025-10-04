import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

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
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        'broken,row,only,three',
        'incomplete,line',
        'single',
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe('u1');
    });

    it('should skip lines with non-numeric status or latencyMs', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:13:00Z,u2,/api/users,invalid,250',
        '2025-01-03T10:14:00Z,u3,/api/orders,200,invalid',
        '2025-01-03T10:15:00Z,u4,/api/users,abc,def',
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe('u1');
    });

    it('should skip header line', () => {
      const rows = parseLines([
        'timestamp,userId,path,status,latencyMs',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:13:00Z,u2,/api/users,404,250',
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0].userId).toBe('u1');
      expect(rows[1].userId).toBe('u2');
    });

    it('should skip empty and whitespace-only lines', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '',
        '   ',
        '2025-01-03T10:13:00Z,u2,/api/users,404,250',
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
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        ',u2,/api/users,404,250',
        '2025-01-03T10:13:00Z,,/api/orders,200,150',
        '2025-01-03T10:14:00Z,u3,,404,200',
        '2025-01-03T10:15:00Z,u4,/api/users,,300',
        '2025-01-03T10:16:00Z,u5,/api/orders,200,',
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe('u1');
    });
  });

  describe('filterByDate (via aggregate)', () => {
    it('should include dates exactly matching from/to boundaries (UTC filtering)', () => {
      const result = aggregate([
        '2025-01-01T10:00:00Z,u1,/api/test,200,100',
        '2024-12-31T23:59:59Z,u2,/api/test,200,150',
        '2025-01-03T12:00:00Z,u3,/api/test,200,200',
        '2025-01-05T23:59:59Z,u4,/api/test,200,250',
        '2025-01-06T00:00:01Z,u5,/api/test,200,300',
        '2025-01-02T08:30:00Z,u6,/api/test,200,175',
      ], {
        from: '2025-01-01',
        to: '2025-01-05',
        tz: 'jst',
        top: 10
      });


      expect(result).toHaveLength(4);

      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-06']);
    });    it('should exclude dates before from boundary', () => {
      const result = aggregate([
        '2024-12-31T23:59:59Z,u1,/api/test,200,100',
        '2025-01-01T00:00:00Z,u2,/api/test,200,150',
        '2025-01-02T12:00:00Z,u3,/api/test,200,200',
      ], {
        from: '2025-01-01',
        to: '2025-01-31',
        tz: 'jst',
        top: 10
      });

      expect(result).toHaveLength(2);
      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-01', '2025-01-02']);
    });

    it('should exclude dates after to boundary (UTC filtering)', () => {
      const result = aggregate([
        '2025-01-03T12:00:00Z,u1,/api/test,200,100',
        '2025-01-05T23:59:59Z,u2,/api/test,200,150',
        '2025-01-06T00:00:01Z,u3,/api/test,200,200',
      ], {
        from: '2025-01-01',
        to: '2025-01-05',
        tz: 'jst',
        top: 10
      });

      expect(result).toHaveLength(2);
      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-03', '2025-01-06']);
    });

    it('should include dates within the range (UTC filtering)', () => {
      const result = aggregate([
        '2025-01-02T08:00:00Z,u1,/api/test,200,100',
        '2025-01-03T12:00:00Z,u2,/api/test,200,150',
        '2025-01-04T16:00:00Z,u3,/api/test,200,200',
      ], {
        from: '2025-01-01',
        to: '2025-01-05',
        tz: 'jst',
        top: 10
      });

      expect(result).toHaveLength(3);
      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-02', '2025-01-03', '2025-01-05']);
    });    it('should handle edge case: same from and to date', () => {
      const result = aggregate([
        '2025-01-02T23:59:59Z,u1,/api/test,200,100',
        '2025-01-03T08:00:00Z,u2,/api/test,200,150',
        '2025-01-03T16:00:00Z,u3,/api/test,200,200',
        '2025-01-04T00:00:01Z,u4,/api/test,200,250',
      ], {
        from: '2025-01-03',
        to: '2025-01-03',
        tz: 'jst',
        top: 10
      });

      expect(result).toHaveLength(2);
      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-03', '2025-01-04']);
    });

    it('should demonstrate UTC filtering vs JST grouping behavior', () => {
      const result = aggregate([
        '2025-01-02T15:00:00Z,u1,/api/test,200,100',
        '2025-01-02T14:59:59Z,u2,/api/test,200,150',
      ], {
        from: '2025-01-02',
        to: '2025-01-02',
        tz: 'jst',
        top: 10
      });


      expect(result).toHaveLength(2);
      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-02', '2025-01-03']);
    });
  });

  it.todo('aggregate basic');
});
