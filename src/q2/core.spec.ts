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

  it('parseLines: skips rows with non-numeric values', () => {

    const sampleLines = [
      '2025-01-15T10:00:00Z,u1,/api/ok,200,100',      // Correct line
      '2025-01-15T10:01:00Z,u1,/api/bad,invalid,100', // Line with non-numeric status
      '2025-01-15T10:02:00Z,u1,/api/slow,200,slow',     // Line with non-numeric latency
    ];

    // 2. Call parseLines function
    const rows = parseLines(sampleLines);

    // 3. Expected result: Only 1 valid row should be kept
    expect(rows.length).toBe(1);
    expect(rows[0].path).toBe('/api/ok');
  });

  it('should handle a comprehensive data set correctly', () => {


    const sampleLines = [
      //  03/01
      '2025-01-03T10:12:00Z,u1,/api/orders,200,120',
      '2025-01-03T10:13:00Z,u2,/api/orders,200,180', // -> count: 2, avg: 150
      '2025-01-03T11:00:00Z,u3,/api/users,200,90',   // -> count: 1, avg: 90

      // 2. 10/01
      '2025-01-10T01:00:00Z,u1,/api/c,200,50',
      '2025-01-10T02:00:00Z,u2,/api/c,200,60',
      '2025-01-10T03:00:00Z,u3,/api/c,200,70',       // -> /api/c, count: 3
      '2025-01-10T04:00:00Z,u4,/api/a,200,110',
      '2025-01-10T05:00:00Z,u5,/api/a,200,130',      // -> /api/a, count: 2
      '2025-01-10T06:00:00Z,u6,/api/b,200,200',
      '2025-01-10T07:00:00Z,u7,/api/b,200,220',      // -> /api/b, count: 2 (out top 2)

      // 3. 15/01 (transfer into 16/01 in JST)
      '2025-01-15T17:00:00Z,u8,/api/reports,200,500', // -> date: 2025-01-16

      // 4. error line
      '2025-01-20T10:00:00Z,u9,/api/bad,invalid,100',
      'missing,columns',

      // 5. Out of range (February)
      '2025-02-05T10:00:00Z,u11,/api/future,200,80',
    ];

    const options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst' as const,
      top: 2,
    };

    const expectedOutput = [
      // 03/01 first
      { date: '2025-01-03', path: '/api/orders', count: 2, avgLatency: 150 },
      { date: '2025-01-03', path: '/api/users', count: 1, avgLatency: 90 },

      // 10/01 second, only top 2
      // /api/c (count 3) first
      { date: '2025-01-10', path: '/api/c', count: 3, avgLatency: 60 },
      // /api/a (count 2) first
      { date: '2025-01-10', path: '/api/a', count: 2, avgLatency: 120 },

      // 16/01 (transfer into 16/01 in JST) last
      { date: '2025-01-16', path: '/api/reports', count: 1, avgLatency: 500 },
    ];

    const result = aggregate(sampleLines, options);
    expect(result).toEqual(expectedOutput);
  });
});
