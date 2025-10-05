import { describe, expect, it } from 'vitest';
import { aggregate, filterByDate, groupByDatePath, parseLines, rankTop, toTZDate } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
    ]);
    expect(rows.length).toBe(1);
  });

  it.todo('aggregate basic');

  it('period filter: include `from/to` boundaries / exclude out-of-range rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      '1996-09-06T12:30:00Z,u2,/b,200,99',
      '2023-02-04T10:12:00Z,u3,/a,200,100',
      '1977-09-06T12:30:00Z,u4,/b,200,99',
    ]);
    const filteredDate = filterByDate(rows, '1971-09-02', '2005-03-06'); //include from 1971-09-02 to 2005-03-06
    const correctAnswer = parseLines(['1977-09-06T12:30:00Z,u4,/b,200,99', '1996-09-06T12:30:00Z,u2,/b,200,99',]); //flip order in parseLines
    expect(filteredDate).toEqual(expect.arrayContaining(correctAnswer)); //arrayContaining: order does not matter
  });

  it('UTC to JST', ()=>{
    const result = toTZDate('2025-01-03T15:00:00Z', 'jst');
    // 15:00 UTC + 9h = 00:00 2025-01-04
    expect(result).toBe('2025-01-04');
  });

  it('UTC to ICT', ()=>{
    const result = toTZDate('2025-01-03T17:00:00Z', 'ict');
    // 17:00 UTC + 7h = 00:00 2025-01-04
    expect(result).toBe('2025-01-04');
  });

  it('aggregation: match count and average for `date × path` (TZ: ICT)', ()=>{
    /*group: same date (after +7h) AND same path
      different date (after +7h) OR different path => separate group*/
    const rows = parseLines([
      '2025-01-03T17:00:00Z,u1,/a,200,100',
      '2025-01-04T03:00:00Z,u2,/a,200,51',
      '2025-01-04T10:00:00Z,u3,/b,200,150',
      '2025-01-04T10:00:00Z,u4,/a,200,75',
    ]);
    const result = groupByDatePath(rows, 'ict');
    const correctAnswer = [
      { date: '2025-01-04', path: '/a', count: 3, avgLatency: 75 }, //75.3 round down to 75
      { date: '2025-01-04', path: '/b', count: 1, avgLatency: 150 },
    ];
    expect(result).toEqual(correctAnswer);
  });

  it('aggregation: match count and average for `date × path` (TZ: JST)', ()=>{
    /*group: same date (after +9h) AND same path
      different date (after +9h) OR different path => separate group*/
    const rows = parseLines([
      '2025-01-03T15:00:00Z,u1,/a,200,101',
      '2025-01-04T03:00:00Z,u2,/a,200,51',
      '2025-01-04T10:00:00Z,u3,/b,200,150',
      '2025-01-04T10:00:00Z,u4,/a,200,75',
    ]);
    const result = groupByDatePath(rows, 'jst');
    const correctAnswer = [
      { date: '2025-01-04', path: '/a', count: 3, avgLatency: 76 }, //75.6 round up to 76
      { date: '2025-01-04', path: '/b', count: 1, avgLatency: 150 },
    ];
    expect(result).toEqual(correctAnswer);
  });

  it('top N: sort by `count` descending for each date, and ascending by `path` for ties', () => {
    const result = rankTop([
      { date: '2025-01-04', path: '/a', count: 3, avgLatency: 76 },
      { date: '2025-01-04', path: '/b', count: 1, avgLatency: 70 },
      { date: '2025-01-04', path: '/c', count: 4, avgLatency: 50 },
      { date: '2025-01-04', path: '/d', count: 1, avgLatency: 50 }, /* d's count = b's count, but d > b => removed */
      { date: '1990-01-04', path: '/c', count: 3, avgLatency: 150 },
      { date: '1990-01-04', path: '/a', count: 1, avgLatency: 150 }, /* count = 1 => removed */
      { date: '1990-01-04', path: '/d', count: 3, avgLatency: 60 },
      { date: '1990-01-04', path: '/b', count: 4, avgLatency: 80 },
    ], 3) // Top 3 of same date!!
    const correctAnswer = [
      { date: '1990-01-04', path: '/b', count: 4, avgLatency: 80 },
      { date: '1990-01-04', path: '/c', count: 3, avgLatency: 150 },
      { date: '1990-01-04', path: '/d', count: 3, avgLatency: 60 },
      { date: '2025-01-04', path: '/c', count: 4, avgLatency: 50 },
      { date: '2025-01-04', path: '/a', count: 3, avgLatency: 76 },
      { date: '2025-01-04', path: '/b', count: 1, avgLatency: 70 },
    ]; // sort by date ASC
    expect(result).toEqual(correctAnswer);
  });

  it('aggregate basic', () => {
    const result = aggregate([
      '2025-01-03T15:00:00Z,u1,/a,200,101',
      '2025-01-04T03:00:00Z,u2,/a,200,51',
      '2025-01-04T10:00:00Z,u3,/b,200,150',
      '2025-01-04T10:00:00Z,u4,/a,200,75',
      '2025-01-03T15:00:00Z,u5,/c,200,100',
      '2025-01-04T03:00:00Z,u6,/c,200,51',
      '2025-01-04T10:00:00Z,u7,/b,200,70',
      '2025-01-04T10:00:00Z,u8,/c,200,75',
      '1991-01-03T15:00:00Z,u9,/b,200,50',
      '1991-01-04T10:00:00Z,u10,/b,200,50',
      '1980-02-10T10:00:00Z,u11,/c/200/75', /* out of bound => removed */
    ], {from: '1990-01-01', to:'2025-02-05', tz: 'jst', top: 3});
    const correctAnswer = [
      { date: '1991-01-04', path: '/b', count: 2, avgLatency: 50 },
      { date: '2025-01-04', path: '/a', count: 3, avgLatency: 76 },
      { date: '2025-01-04', path: '/c', count: 3, avgLatency: 75 },
      { date: '2025-01-04', path: '/b', count: 2, avgLatency: 110 }
    ];
    expect(result).toEqual(correctAnswer);
  });

    it('aggregate (large data)', () => {
    const data = [
      '2025-01-03T15:00:00Z,u1,/a,200,101',
      '2025-01-04T03:00:00Z,u2,/a,200,51',
      '2025-01-04T10:00:00Z,u3,/b,200,150',
      '2025-01-04T10:00:00Z,u4,/a,200,75',
      '2025-01-03T15:00:00Z,u5,/c,200,100',
      '2025-01-04T03:00:00Z,u6,/c,200,51',
      '2025-01-04T10:00:00Z,u7,/b,200,70',
      '2025-01-04T10:00:00Z,u8,/c,200,75',
      '1991-01-03T15:00:00Z,u9,/b,200,50',
      '1991-01-04T10:00:00Z,u10,/b,200,80',
      '1991-01-04T10:00:00Z,u12,/b,200,70',
      '1991-01-04T10:00:00Z,u13,/b,200,76',
      '1991-01-04T10:00:00Z,u420,/b,200,79',
      '1980-02-10T10:00:00Z,u11,/c,200,75',
      '1992-03-04T10:00:00Z,u11,/c,200,75',
      '1992-03-04T10:00:00Z,u11,/c,200,75',
      '1992-03-04T10:00:00Z,u11,/c,200,75',
      '1994-03-04T10:00:00Z,u11,/a,200,75',
      '1994-03-04T10:00:00Z,u11,/a,200,75',
      '1994-03-04T10:00:00Z,u11,/a,200,75',
      '1994-03-04T10:00:00Z,u11,/a,200,75',
      '1994-03-04T10:00:00Z,u11,/a,200,75',
      '1994-03-04T10:00:00Z,u11,/a,200,75',
      '1994-03-04T10:00:00Z,u11,/a,200,75',
    ];
    const result = aggregate( data, {from: '1990-01-01', to:'2025-02-05', tz: 'jst', top: 3});
    const correctAnswer = [
      { date: '1991-01-04', path: '/b', count: 5, avgLatency: 71 },
      { date: '1992-03-04', path: '/c', count: 3, avgLatency: 75 },
      { date: '1994-03-04', path: '/a', count: 7, avgLatency: 75 },
      { date: '2025-01-04', path: '/a', count: 3, avgLatency: 76 },
      { date: '2025-01-04', path: '/c', count: 3, avgLatency: 75 },
      { date: '2025-01-04', path: '/b', count: 2, avgLatency: 110 },
    ];
    expect(result).toEqual(correctAnswer);
  });
});
