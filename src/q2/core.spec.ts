import { describe, expect, it } from 'vitest';
import {
  aggregate,
  filterByDate,
  groupByDatePath,
  parseLines,
  rankTop,
  Row,
  toTZDate,
} from './core.js';

describe('Q2 Core Functions', () => {
  describe('parseLines()', () => {
    it('parses correct rows and skips invalid ones', () => {
      const lines = [
        '2025-02-01T00:00:00Z,u1,/a,200,100',
        'broken,row,data',
        '2025-02-01T01:00:00Z,u2,/b,404,300',
        'timestamp,userId,path,status,latencyMs', // header
        '2025-02-01T02:00:00Z,u3,/c,200,notANumber',
      ];
      const rows = parseLines(lines);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.userId)).toEqual(['u1', 'u2']);
    });

    it('trims spaces and ignores empty fields', () => {
      const lines = [' 2025-02-02T00:00:00Z , u10 , /api , 200 , 123 '];
      const rows = parseLines(lines);
      expect(rows[0]).toMatchObject({
        userId: 'u10',
        path: '/api',
        status: 200,
        latencyMs: 123,
      });
    });
  });

  describe('filterByDate()', () => {
    const rows: Row[] = [
      {
        timestamp: '2025-03-01T23:59:59Z',
        userId: 'a',
        path: '/p',
        status: 200,
        latencyMs: 10,
      },
      {
        timestamp: '2025-03-02T00:00:00Z',
        userId: 'b',
        path: '/p',
        status: 200,
        latencyMs: 20,
      },
      {
        timestamp: '2025-03-02T12:00:00Z',
        userId: 'c',
        path: '/p',
        status: 200,
        latencyMs: 30,
      },
      {
        timestamp: '2025-03-03T23:59:59Z',
        userId: 'd',
        path: '/p',
        status: 200,
        latencyMs: 40,
      },
      {
        timestamp: '2025-03-04T00:00:00Z',
        userId: 'e',
        path: '/p',
        status: 200,
        latencyMs: 50,
      },
    ];

    it('keeps rows inclusively between from/to', () => {
      const filtered = filterByDate(rows, '2025-03-02', '2025-03-03');
      expect(filtered.map((r) => r.userId)).toEqual(['b', 'c', 'd']);
    });
  });

  describe('toTZDate()', () => {
    it('converts UTC to JST correctly with date shift', () => {
      const utc = '2025-04-01T18:00:00Z'; // JST +9 => next day
      expect(toTZDate(utc, 'jst')).toBe('2025-04-02');
    });

    it('converts UTC to ICT correctly without date shift', () => {
      const utc = '2025-04-01T10:00:00Z'; // ICT +7 => same day
      expect(toTZDate(utc, 'ict')).toBe('2025-04-01');
    });
  });

  describe('groupByDatePath()', () => {
    it('aggregates count and average latency per date+path', () => {
      const rows: Row[] = [
        {
          timestamp: '2025-05-01T18:00:00Z',
          userId: 'x',
          path: '/api/u',
          status: 200,
          latencyMs: 100,
        },
        {
          timestamp: '2025-05-01T19:00:00Z',
          userId: 'y',
          path: '/api/u',
          status: 200,
          latencyMs: 300,
        },
        {
          timestamp: '2025-05-01T20:00:00Z',
          userId: 'z',
          path: '/api/p',
          status: 200,
          latencyMs: 200,
        },
      ];
      const grouped = groupByDatePath(rows, 'jst');
      const u = grouped.find((g) => g.path === '/api/u');
      expect(u).toMatchObject({ count: 2, avgLatency: 200 });
      const p = grouped.find((g) => g.path === '/api/p');
      expect(p).toMatchObject({ count: 1, avgLatency: 200 });
    });
  });

  describe('rankTop()', () => {
    it('takes top N per day and sorts deterministically', () => {
      const items = [
        { date: '2025-06-01', path: '/a', count: 5, avgLatency: 100 },
        { date: '2025-06-01', path: '/b', count: 5, avgLatency: 200 },
        { date: '2025-06-01', path: '/c', count: 1, avgLatency: 300 },
        { date: '2025-05-31', path: '/z', count: 10, avgLatency: 50 },
      ];
      const ranked = rankTop(items, 2);
      // 31st May first
      expect(ranked[0].date).toBe('2025-05-31');
      // For 1st June only two with highest count kept, path order tie-break
      expect(
        ranked.filter((r) => r.date === '2025-06-01').map((r) => r.path)
      ).toEqual(['/a', '/b']);
    });
  });

  describe('aggregate()', () => {
    it('end-to-end: parse, filter, group, rank', () => {
      const lines = [
        'timestamp,userId,path,status,latencyMs',
        '2025-07-01T10:00:00Z,u1,/x,200,100',
        '2025-07-01T11:00:00Z,u2,/x,200,200',
        '2025-07-01T12:00:00Z,u3,/y,200,300',
      ];
      const out = aggregate(lines, {
        from: '2025-07-01',
        to: '2025-07-01',
        tz: 'jst',
        top: 1,
      });
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ path: '/x', count: 2, avgLatency: 150 });
    });
  });
});
