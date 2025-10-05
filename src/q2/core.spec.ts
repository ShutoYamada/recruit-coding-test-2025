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

    it('aggregate: should filter by date, group, and calculate correctly', () => {

    const sampleLines = [
      '2025-01-03T10:00:00Z,u1,/api/a,200,100', // JST: 2025-01-03
      '2025-01-03T11:00:00Z,u2,/api/a,200,140', // JST: 2025-01-03
      '2025-01-04T09:00:00Z,u3,/api/b,200,200', // JST: 2025-01-04
      '2025-02-01T10:00:00Z,u4,/api/c,200,300', // JST: 2025-02-01 (should be filtered out)
    ];


    const options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst' as const,
      top: 5,
    };

    const result = aggregate(sampleLines, options);


    const expectedOutput = [
      { date: '2025-01-03', path: '/api/a', count: 2, avgLatency: 120 }, // (100+140)/2 = 120
      { date: '2025-01-04', path: '/api/b', count: 1, avgLatency: 200 },
    ];

    expect(result).toEqual(expectedOutput);
  });



    it('aggregate: should select top N for each day and handle ties', () => {
      const sampleLines = [
        '2025-01-15T10:00:00Z,u1,/api/c,200,100',
        '2025-01-15T10:01:00Z,u1,/api/c,200,100',
        '2025-01-15T10:02:00Z,u1,/api/c,200,100',
        '2025-01-15T11:00:00Z,u1,/api/a,200,100',
        '2025-01-15T11:01:00Z,u1,/api/a,200,100',
        '2025-01-15T12:00:00Z,u1,/api/b,200,100',
        '2025-01-15T12:01:00Z,u1,/api/b,200,100',
        '2025-01-15T13:00:00Z,u1,/api/d,200,100',
      ];

      const options = {
        from: '2025-01-01',
        to: '2025-01-31',
        tz: 'jst' as const,
        top: 2,
      };

      const result = aggregate(sampleLines, options);

      const expectedOutput = [

        { date: '2025-01-15', path: '/api/c', count: 3, avgLatency: 100 },

        { date: '2025-01-15', path: '/api/a', count: 2, avgLatency: 100 },
      ];
      expect(result).toEqual(expectedOutput);
    });
});
