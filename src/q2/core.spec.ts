/* eslint-disable max-lines-per-function */
import { describe, expect, it } from 'vitest';
import { parseLines, filterByDate, toTZDate, aggregate } from './core.js';
import { Row, TZ, Options, Output } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
    ]);
    expect(rows.length).toBe(1);
  });

  it('parseLines: skips row with empty column', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,,only,three,four',
    ]);
    expect(rows.length).toBe(1);
  });

  it('parseLines: skips row with too many columns', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three,four,five',
    ]);
    expect(rows.length).toBe(1);
  }); 

  it('parseLines: skips row with invalid timestamp', () => {
    const rows = parseLines([
      /**
       * Timestamp must follow format: YYYY-MM-DDTHH:mm:ssZ
       * Detailed constraints:
       *  - YYYY: year (0000 - 9999)
       *  - MM: month (01 - 12)
       *  - DD: day (01 - max days in month, considering leap years: February has 28 or 29 days)
       *  - HH: hour (00 - 23)
       *  - mm: minutes (00 - 59)
       *  - ss: seconds (00 - 59)
       *  - Must use character 'T' between date and time, and 'Z' (UTC) at the end, no other offset allowed.
       */
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      '2025-01-03T00:00:00Z,u1,/a,200,100',
      '2025-01-03T23:59:59Z,u1,/a,200,100',
      '2016-02-29T10:12:00Z,u1,/a,200,100', // Leap year -> valid
      '2017-02-29T10:12:00Z,u1,/a,200,100', // Invalid because 2017-02-29 does not exist
      '2025-01-03T24:12:00Z,u1,/a,200,100', // Invalid because HH > 23
      '2025-01-03T10:12:00,u1,/a,200,100', // Invalid because missing 'Z'
      '01-03-2025T10:12:00Z,u1,/a,200,100', // Invalid because format is DD-MM-YYYY
      '2025/01/03T10:12:00Z,u1,/a,200,100', // Invalid because uses '/'
      '2025-01-03,u1,/a,200,100', // Invalid because missing time
      '10:12:00Z,u1,/a,200,100', // Invalid because missing date
      '2025-1-03T10:12:00Z,u1,/a,200,100', // Invalid because month not zero-padded
      '2025-01-03T10:12:00.123Z,u1,/a,200,100', // Invalid because contains milliseconds
      '2025-01-03 T 10:12:00 Z,u1,/a,200,100', // Invalid because contains spaces
    ]);
    expect(rows.length).toBe(4);
  });

  it('parseLines: skips row with invalid userid', () => {
    /**
     * userid may only contain a-z, A-Z, 0-9, '-', '_', '.', '@'
     */
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      '2025-01-03T10:12:00Z,u***,/a,200,100', // contains disallowed characters
    ]);
    expect(rows.length).toBe(1);
  });

  it('parseLines: skips row with invalid path', () => {
    const rows = parseLines([
      /**
       * Path must follow rules:
       *  - Must start with '/'.
       *  - Can only contain valid characters:
       *    + Letters: a–z, A–Z
       *    + Digits: 0–9
       *    + Symbols: '-', '_', '.'
       *    + '/' as segment separator
       *  - No whitespace or control characters.
       *  - No consecutive '/' (not allowed '//').
       *  - Any other special character must be percent-encoded /%[0-9A-Fa-f]{2}/.
       */
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      '2025-01-03T10:12:00Z,u1,/css/main.css,200,100', 
      '2025-01-03T10:12:00Z,u1,/css%,200,100', // Invalid because '%' is incomplete
      '2025-01-03T10:12:00Z,u1,css/main.css,200,100',  // Invalid because does not start with '/'
      '2025-01-03T10:12:00Z,u1,/css /main.css,200,100',  // Invalid because contains space
      '2025-01-03T10:12:00Z,u1,/css//main.css,200,100',  // Invalid because contains //
      '2025-01-03T10:12:00Z,u1,/a|b,200,100',  // Invalid because contains disallowed character
    ]);
    expect(rows.length).toBe(2);
  }) 

  it('parseLines: skips row with invalid status', () => {
    /**
     * status must be an integer between 100 - 599 (inclusive)
     */
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      '2025-01-03T10:12:00Z,u1,/a,404,100',
      '2025-01-03T10:12:00Z,u1,/a,100,100',
      '2025-01-03T10:12:00Z,u1,/a,599,100',
      '2025-01-03T10:12:00Z,u1,/a,60,100', // Invalid because status < 100
      '2025-01-03T10:12:00Z,u1,/a,600,100', // Invalid because status > 599
      '2025-01-03T10:12:00Z,u1,/a,ok,100', // Invalid because contains letters
    ]);
    expect(rows.length).toBe(4);
  });

  it('parseLines: skips row with invalid latencyMs', () => {
    /**
     * latencyMs must be a non-negative integer
     */
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      '2025-01-03T10:12:00Z,u1,/a,200,-100', // Invalid because negative number
      '2025-01-03T10:12:00Z,u1,/a,200,100.123', // Invalid because decimal
      '2025-01-03T10:12:00Z,u1,/a,200,abc', // Invalid because not a number
    ]);
    expect(rows.length).toBe(1);
  });

  it('filterByDate: remove out-of-range', () => {
    const from = '2025-01-03';
    const to = '2025-01-13';
    const rows: Row[] = [
      {
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/a',
        status: 200,
        latencyMs: 100,
      }, 
      {
        timestamp: '2025-01-13T10:12:00Z',
        userId: 'u1',
        path: '/a',
        status: 200,
        latencyMs: 100,
      }, 
      {
        timestamp: '2025-01-05T10:12:00Z',
        userId: 'u1',
        path: '/a',
        status: 200,
        latencyMs: 100,
      }, 
      {
        timestamp: '2025-01-01T10:12:00Z', // Invalid because it is not within (from - to)
        userId: 'u1',
        path: '/a',
        status: 200,
        latencyMs: 100,
      }, 
      {
        timestamp: '2025-01-15T10:12:00Z', // Invalid because it is not within (from - to)
        userId: 'u1',
        path: '/a',
        status: 200,
        latencyMs: 100,
      }, 
    ];
    const out = filterByDate(rows, from, to);
    expect(out.length).toBe(3);
  });

  it('toTZDate: convert UTC→JST/ICT', () => {
    const input: [string, TZ][] = [
      ['2025-01-01T00:00:00Z', 'jst'],
      ['2025-01-01T00:30:00Z', 'jst'],
      ['2025-01-01T12:30:00Z', 'jst'],

      ['2025-01-01T15:00:00Z', 'jst'], // Boundary case
      ['2025-01-01T23:30:00Z', 'jst'],

      ['2025-01-01T15:00:00Z', 'ict'], 
      ['2025-01-01T17:00:00Z', 'ict'], // Boundary case

      ['2025-01-31T23:00:00Z', 'ict'], // Crosses into February
      ['2025-02-28T23:00:00Z', 'ict'], // Crosses into March, non-leap year
      ['2024-02-29T23:00:00Z', 'ict'], // Crosses into March, leap year
      ['2025-04-30T23:00:00Z', 'ict'], // Crosses into May
      
      ['2025-12-31T23:00:00Z', 'ict'], // Crosses into next year
    ];
    const out = input.map((i) => toTZDate(i[0], i[1]));
    expect(out.join('\n')).toBe([
      '2025-01-01',
      '2025-01-01',
      '2025-01-01',

      '2025-01-02',
      '2025-01-02',

      '2025-01-01',
      '2025-01-02',

      '2025-02-01',
      '2025-03-01',
      '2024-03-01',
      '2025-05-01',

      '2026-01-01',
    ].join('\n'));
  });

  it('aggregate: count and average per date-path must be correct', () => {
    const options: Options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 3
    };
    const input: string[][] = [
      // 2025-01-03 x users
      ['2025-01-03T10:12:00Z,u1,/api/users,200,120',
      '2025-01-03T10:12:00Z,u2,/api/users,200,140',],
      // 2025-01-04 x users
      ['2025-01-04T10:12:00Z,u3,/api/users,200,60',
      '2025-01-04T10:12:00Z,u2,/api/users,200,200',
      '2025-01-04T10:12:00Z,u4,/api/users,200,70'],
      // 2025-01-03 x orders
      ['2025-01-03T10:12:00Z,u1,/api/orders,200,120',
      '2025-01-03T10:12:00Z,u1,/api/orders,200,150',
      '2025-01-03T10:12:00Z,u2,/api/orders,200,150'],
      // 2025-01-04 x orders
      ['2025-01-04T10:12:00Z,u3,/api/orders,200,80',
      '2025-01-04T10:12:00Z,u4,/api/orders,200,300',
      '2025-01-04T10:12:00Z,u5,/api/orders,200,100'],
      // 2025-01-05 x orders
      ['2025-01-05T10:12:00Z,u5,/api/orders,200,60'],
    ];
    const out: Output = input.flatMap((i) => aggregate(i, options));
    expect(out).toEqual([
      { date: '2025-01-03', path: '/api/users',  count: 2, avgLatency: 130 },
      { date: '2025-01-04', path: '/api/users',  count: 3, avgLatency: 110 },
      { date: '2025-01-03', path: '/api/orders', count: 3, avgLatency: 140 },
      { date: '2025-01-04', path: '/api/orders', count: 3, avgLatency: 160 },
      { date: '2025-01-05', path: '/api/orders', count: 1, avgLatency: 60  },
    ]);
  });

});
