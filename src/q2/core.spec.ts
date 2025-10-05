/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, expect, it } from 'vitest';
import { parseLines, aggregate } from './core.js';
import { Options, Output } from './core.js';

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

  it('aggregate: remove out-of-range', () => {
    const options: Options = {
      from: '2025-01-03',
      to: '2025-01-13',
      tz: 'jst',
      top: 3
    };
    const input: string[] = [
      '2025-01-03T10:12:00Z,u1,/api/users,200,120',
      '2025-01-13T10:12:00Z,u1,/api/users,200,120',
      '2025-01-05T10:12:00Z,u1,/api/users,200,120',
      '2025-01-01T10:12:00Z,u1,/api/users,200,120', // Invalid because it is not within (from - to)
      '2025-01-15T10:12:00Z,u1,/api/users,200,120', // Invalid because it is not within (from - to)
    ]
    const out = aggregate(input, options);
    expect(out.length).toBe(3);
  });

  it('aggregate: convert UTC→JST/ICT', () => {
    const input: [string, 'jst' | 'ict'][] = [
      ['2025-01-01T00:10:00Z,u1,/api/users,200,120', 'jst'],
      ['2025-01-01T00:30:00Z,u1,/api/users,200,120', 'jst'],
      ['2025-01-01T12:30:00Z,u1,/api/users,200,120', 'jst'],

      ['2025-01-01T15:00:00Z,u1,/api/users,200,120', 'jst'], // Boundary case
      ['2025-01-01T23:30:00Z,u1,/api/users,200,120', 'jst'],

      ['2025-01-01T15:00:00Z,u1,/api/users,200,120', 'ict'], 
      ['2025-01-01T17:00:00Z,u1,/api/users,200,120', 'ict'], // Boundary case

      ['2025-01-31T23:00:00Z,u1,/api/users,200,120', 'ict'], // Crosses into February
      ['2025-02-28T23:00:00Z,u1,/api/users,200,120', 'ict'], // Crosses into March, non-leap year
      ['2024-02-29T23:00:00Z,u1,/api/users,200,120', 'ict'], // Crosses into March, leap year
      ['2025-04-30T23:00:00Z,u1,/api/users,200,120', 'ict'], // Crosses into May
      
      ['2025-12-31T23:00:00Z,u1,/api/users,200,120', 'ict'], // Crosses into next year
    ];

    const out = input.map((i) => {
      const options: Options = {
        from: '2024-01-01',
        to: '2025-12-31',
        tz: i[1],
        top: 100
      }
      return aggregate([i[0]], options)[0]['date'];
    });
    expect(out.join('\n')).toEqual([
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
      // 2025-01-06 x orders (rounding check: 1.33 -> 1)
      ['2025-01-06T10:12:00Z,u3,/api/orders,200,1',
      '2025-01-06T10:12:00Z,u4,/api/orders,200,1',
      '2025-01-06T10:12:00Z,u5,/api/orders,200,2'],
      // 2025-01-07 x orders (rounding check: 1.67 -> 2)
      ['2025-01-07T10:12:00Z,u3,/api/orders,200,1',
      '2025-01-07T10:12:00Z,u4,/api/orders,200,2',
      '2025-01-07T10:12:00Z,u5,/api/orders,200,2'],
      // 2025-01-08 x orders (rounding check: 1.5 -> 2)
      ['2025-01-08T10:12:00Z,u3,/api/orders,200,1',
      '2025-01-08T10:12:00Z,u4,/api/orders,200,2',],
    ];
    const out: Output = input.flatMap((i) => aggregate(i, options));
    expect(out).toEqual([
      { date: '2025-01-03', path: '/api/users',  count: 2, avgLatency: 130 },
      { date: '2025-01-04', path: '/api/users',  count: 3, avgLatency: 110 },
      { date: '2025-01-03', path: '/api/orders', count: 3, avgLatency: 140 },
      { date: '2025-01-04', path: '/api/orders', count: 3, avgLatency: 160 },
      { date: '2025-01-05', path: '/api/orders', count: 1, avgLatency: 60  },
      { date: '2025-01-06', path: '/api/orders', count: 3, avgLatency: 1  },
      { date: '2025-01-07', path: '/api/orders', count: 3, avgLatency: 2  },
      { date: '2025-01-08', path: '/api/orders', count: 2, avgLatency: 2  },
    ]);
  });

  it('aggregate: Top N: per day, sort by count DESC, path ASC', () => {
    const options: Options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 2
    };

    const input: string[][] = [
      // users: 1, orders: 2
      [
        '2025-01-03T10:12:00Z,u1,/api/users,200,100',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:12:00Z,u2,/api/orders,200,100',
      ],
      // users: 1, orders: 1
      [
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:12:00Z,u1,/api/users,200,100',
      ],
      // users: 1, orders: 1, change input order to test sorting when counts are equal
      [
        '2025-01-03T10:12:00Z,u1,/api/users,200,100',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
      ],
      // users: 1, orders: 1, login: 1
      [
        '2025-01-03T10:12:00Z,u1,/api/users,200,100',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:12:00Z,u1,/api/login,200,100',
      ],
      // users: 2, orders: 1
      [
        '2025-01-03T10:12:00Z,u1,/api/users,200,100',
        '2025-01-03T10:12:00Z,u2,/api/users,200,100',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
      ],
      // users: 1, orders: 2, login: 3
      [
        '2025-01-03T10:12:00Z,u1,/api/users,200,100',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:12:00Z,u2,/api/orders,200,100',
        '2025-01-03T10:12:00Z,u1,/api/login,200,100',
        '2025-01-03T10:12:00Z,u2,/api/login,200,100',
        '2025-01-03T10:12:00Z,u3,/api/login,200,100',
      ],
    ];

    const out = input.map((i) => 
      aggregate(i, options)
        .map((r) => ({
          date: r.date, 
          path: r.path, 
          count: r.count
          // no need to check avgLatency
        }))
    );

    expect(out).toEqual([
      [
        { date: '2025-01-03', path: '/api/orders', count: 2 },
        { date: '2025-01-03', path: '/api/users', count: 1 },
      ],
      [
        { date: '2025-01-03', path: '/api/orders', count: 1 },
        { date: '2025-01-03', path: '/api/users', count: 1 },
      ],
      // the result must be the same as the one above
      [
        { date: '2025-01-03', path: '/api/orders', count: 1 },
        { date: '2025-01-03', path: '/api/users', count: 1 },
      ],
      [
        { date: '2025-01-03', path: '/api/login', count: 1 },
        { date: '2025-01-03', path: '/api/orders', count: 1 },
      ],
      [
        { date: '2025-01-03', path: '/api/users', count: 2 },
        { date: '2025-01-03', path: '/api/orders', count: 1 },
      ],
      // return 2 results (login & orders) because top = 2
      [
        { date: '2025-01-03', path: '/api/login', count: 3 },
        { date: '2025-01-03', path: '/api/orders', count: 2 },
      ]
    ]);
  });

  it('aggregate: The output order must be fixed as: date ASC, count DESC, path ASC', () => {
    const options: Options = {
      from: '2025-01-01',
      to: '2025-01-31',
      tz: 'jst',
      top: 2
    };

    const input: string[][] = [
      // 2025-01-03: (orders: 1), 2025-01-04: (orders: 1), 2025-01-05: (orders: 1)
      [
        '2025-01-05T10:12:00Z,u2,/api/orders,200,100',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-04T10:12:00Z,u1,/api/orders,200,100',
      ],
      // 2025-01-03: (orders: 3), 2025-01-04: (orders: 1), 2025-01-05: (orders: 2)
      [
        '2025-01-05T10:12:00Z,u2,/api/orders,200,100',
        '2025-01-05T10:12:00Z,u2,/api/orders,200,100',

        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',

        '2025-01-04T10:12:00Z,u1,/api/orders,200,100',
      ],
      // 2025-01-03: (orders: 3, users: 1), 2025-01-04: (orders: 1, users: 2), 
      // 2025-01-05: (orders: 2, users: 2), 2025-01-06: (orders: 2, users: 2)(change input order)
      [
        '2025-01-05T10:12:00Z,u2,/api/orders,200,100',
        '2025-01-05T10:12:00Z,u2,/api/users,200,100',
        '2025-01-05T10:12:00Z,u2,/api/orders,200,100',
        '2025-01-05T10:12:00Z,u2,/api/users,200,100',

        '2025-01-06T10:12:00Z,u2,/api/users,200,100',
        '2025-01-06T10:12:00Z,u2,/api/orders,200,100',
        '2025-01-06T10:12:00Z,u2,/api/users,200,100',
        '2025-01-06T10:12:00Z,u2,/api/orders,200,100',

        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:12:00Z,u1,/api/users,200,100',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',

        '2025-01-04T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-04T10:12:00Z,u1,/api/users,200,100',
        '2025-01-04T10:12:00Z,u1,/api/users,200,100',
      ],
    ];

    const out = input.map((i) => 
      aggregate(i, options)
        .map((r) => ({
          date: r.date, 
          path: r.path, 
          count: r.count
          // no need to check avgLatency
        }))
    );

    expect(out).toEqual([
      [
        { date: '2025-01-03', path: '/api/orders', count: 1 },
        { date: '2025-01-04', path: '/api/orders', count: 1 },
        { date: '2025-01-05', path: '/api/orders', count: 1 },
      ],
      [
        { date: '2025-01-03', path: '/api/orders', count: 3 },
        { date: '2025-01-04', path: '/api/orders', count: 1 },
        { date: '2025-01-05', path: '/api/orders', count: 2 },
      ],
      [
        { date: '2025-01-03', path: '/api/orders', count: 3 },
        { date: '2025-01-03', path: '/api/users', count: 1 },

        { date: '2025-01-04', path: '/api/users', count: 2 },
        { date: '2025-01-04', path: '/api/orders', count: 1 },

        { date: '2025-01-05', path: '/api/orders', count: 2 },
        { date: '2025-01-05', path: '/api/users', count: 2 },

        { date: '2025-01-06', path: '/api/orders', count: 2 },
        { date: '2025-01-06', path: '/api/users', count: 2 },
      ]  
    ]);
  });

  it('aggregate: Sample expansion: multiple paths on the same day / duplicate numbers / large data', () => {
    const options: Options = {
      from: '2025-03-10',
      to: '2025-03-20',
      tz: 'ict',
      top: 10
    };
    const fromDate = '2025-03-01';
    const toDate = '2025-03-31';
    const numOfRows = 160000;

    const expectOutput = generateExpectOutput(options);
    const input = generateInputFromExpect(fromDate, toDate, numOfRows, expectOutput, options);
    const out = aggregate(input, options);    
    expect(out).toEqual(expectOutput);     
  });
});

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const MIN_COUNT_NORMAL = 50;
const MAX_COUNT_NORMAL = 250;
const MIN_COUNT_HOTDATE = 1000;
const MAX_COUNT_HOTDATE = 2000;

const MIN_LATENCY_NORMAL = 60;
const MAX_LATENCY_NORMAL = 120;

const MIN_LATENCY_HOTDATE = 120;
const MAX_LATENCY_HOTDATE = 500;

const MIN_LATENCY_NOISE = 80;
const MAX_LATENCY_NOISE = 180;

const P_HOT_DATE = 0.6;
const MAX_USER = 10000;

/**
 * この関数はテスト用のサンプルデータ「expectOutput」を生成するための関数です。
 * データ生成ルール：
 * - `date` は `options` の `from` と `to` から取得されます。
 * - 各日ごとに生成される path の数は options.top です。
 * - 各日には 0.6 の確率でアクセスが多い日（ホットデー）となります。
 * - アクセスが多い日は `count` と `avgLatency` が通常より高くなります。
 * - 生成後、データは以下の順序でソートされます：
 *     `date` 昇順、`count` 降順、`path` 昇順
 * @param options   
 * @returns         `Output` 型の配列。各要素は `{ date, path, count, avgLatency }` を持ちます。
 */
const generateExpectOutput = (options: Options): Output => {
  const expectOutput: Output = [];
  // Add one day to handle cases where converting from UTC to ICT/JST causes the date to shift forward by one day.
  const [y, m, d] = options.to.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + 1));
  const tzTo = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

  for(const date of ForeachDay(options.from, tzTo)) {
    const pHotDate = Math.random();
    const usedPaths = new Set<string>();
    for (let i = 0; i < options.top; ++i) {
      let path;
      do {
        path = `/api/${randomSuffix(3)}`;
      } while (usedPaths.has(path));
      usedPaths.add(path);

      const isHot = pHotDate < P_HOT_DATE;
      const count = Math.round(
        isHot
          ? MIN_COUNT_HOTDATE + Math.random() * (MAX_COUNT_HOTDATE - MIN_COUNT_HOTDATE)
          : MIN_COUNT_NORMAL + Math.random() * (MAX_COUNT_NORMAL - MIN_COUNT_NORMAL)
      );
      const avgLatency = Math.round(
        isHot
          ? MIN_LATENCY_HOTDATE + Math.random() * (MAX_LATENCY_HOTDATE - MIN_LATENCY_HOTDATE)
          : MIN_LATENCY_NORMAL + Math.random() * (MAX_LATENCY_NORMAL - MIN_LATENCY_NORMAL)
      );

      expectOutput.push({ date: date, path, count, avgLatency });
    }
  } 

  expectOutput.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.count !== b.count) return b.count - a.count;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });
  return expectOutput;
};  

/**
 * この関数はテスト用の入力データ（CSV）を生成するためのものです。
 *
 * データ生成ルール：
 * - `expectOutput` に含まれるコアレコード（core）を保持します。  
 *   各要素 `{ date, path, count, avgLatency }` に対して、
 *   対応する日付（`options.tz` のローカル日付）内でランダムな `timestamp` を持つ
 *   `count` 行のCSVデータを生成し、`latencyMs` は平均が `avgLatency` になるように設定します。
 *
 * - 合計行数を `numOfRows` に一致させるため、追加の **ノイズデータ (noise)** を生成します：
 *   - ノイズデータは `fromDate` ～ `toDate` の範囲内（`options.tz` 基準）で作成されます。
 *   - `path` ノイズは末尾に4文字のサフィックス（例：`/api/abcd`）を付けて
 *     `expectOutput`（通常3文字サフィックス）と区別します。
 *   - 各ノイズパスの `count` は小さい値（5～25）に設定し、
 *     日ごとの上位（top=5）に影響しないようにします。
 *   - `latencyMs` ノイズはランダム（例：80～180）にして、
 *     より現実的なデータ分布を模擬します。
 *
 * @param fromDate  データ生成の開始日（`YYYY-MM-DD`、`options.tz` のローカル日付）
 * @param toDate    データ生成の終了日（`YYYY-MM-DD`、`options.tz` のローカル日付）
 * @param numOfRows 生成するCSV行数の合計。`expectOutput` の全count合計以上である必要があります。
 * @param expectOutput  `generateExpectOutput()` により生成された基準データ。
 * @param options   
 * @returns         生成されたCSV文字列の配列。
 */
const generateInputFromExpect = (fromDate: string, toDate: string, 
  numOfRows: number, expectOutput: Output, options: Options): string[] => {
  const input: string[] = [];
  
  const coreTotal = expectOutput.reduce((acc, o) => acc + o.count, 0);
  if (numOfRows < coreTotal) {
    throw new Error(`numOfRows (${numOfRows}) < coreTotal (${coreTotal}).`);
  }
  // Generate core lines based on expectOutput
  let uid = 1;
  for (const out of expectOutput) {
    for (let k = 0; k < out.count; ++k) {
      let dt: string;
      do {
        dt = randomDateTime(out.date, options.tz);
      } while (new Date(dt) < new Date(options.from + 'T00:00:00Z') || 
        new Date(dt) > new Date(options.to + 'T23:59:59Z')); // Ensure it falls within the UTC range (from -> to)

      const userId = `u${uid++}`;
      if (uid > MAX_USER) uid = 1;
      input.push(`${dt},${userId},${out.path},200,${out.avgLatency}`); // Set latency = avgLatency -> ensure the output matches the expected result
    }
  }
  // Generate noise lines
  let remaining = numOfRows - coreTotal;
  if (remaining === 0) return input;
  while(remaining > 0) {
    for(const date of ForeachDay(fromDate, toDate)) {
      const dt = randomDateTime(date, options.tz);
      
      const userId = `u${uid++}`;
      if (uid > MAX_USER) uid = 1;
      
      const path = `/api/${randomSuffix(4)}`;
      const latency = MIN_LATENCY_NOISE + Math.random() * (MAX_LATENCY_NOISE - MIN_LATENCY_NOISE);
      input.push(`${dt},${userId},${path},200,${latency}`);
      --remaining;
      if(remaining < 0) break;
    }
  }
  return input;
};

function* ForeachDay(fromDate: string, toDate: string) {
  const from = new Date(fromDate + "T00:00:00Z").getTime();
  const to = new Date(toDate + "T00:00:00Z").getTime();
  const totalDays = (to - from) / ONE_DAY_MS + 1;
  for(let d = 0; d < totalDays; ++d) {
    const dt = new Date(from + ONE_DAY_MS * d);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dt.getUTCDate()).padStart(2, '0');
    yield `${y}-${m}-${day}`;
  }
}

const randomSuffix = (length: number): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let s = '';
  for (let i = 0; i < length; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

const randomDateTime = (date: string, tz: "jst" | "ict"): string => {
  const baseMs = new Date(date + "T00:00:00Z").getTime();
  const h = Math.floor(Math.random() * 24);
  const m = Math.floor(Math.random() * 60);
  const s = Math.floor(Math.random() * 60);
  const ms = ((h * 60 + m) * 60 + s) * 1000;
  return new Date(baseMs + ms - (tz === "jst" ? 9 : 7) * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19) + 'Z';
}