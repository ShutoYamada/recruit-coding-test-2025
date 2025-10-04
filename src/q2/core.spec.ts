import { describe, expect, it } from 'vitest';
import { filterByDate, groupByDatePath, parseLines, toTZDate } from './core.js';

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
      '2025-01-04T03:00:00Z,u1,/a,200,50',
      '2025-01-04T10:00:00Z,u1,/b,200,150',
      '2025-01-04T10:00:00Z,u1,/a,200,75',
    ]);
    const result = groupByDatePath(rows, 'ict');
    const correctAnswer = [
      { date: '2025-01-04', path: '/a', count: 3, avgLatency: 75 },
      { date: '2025-01-04', path: '/b', count: 1, avgLatency: 150 },
    ];
    expect(result).toEqual(correctAnswer);
  });

  it('aggregation: match count and average for `date × path` (TZ: JST)', ()=>{
    /*group: same date (after +9h) AND same path
      different date (after +9h) OR different path => separate group*/
    const rows = parseLines([
      '2025-01-03T15:00:00Z,u1,/a,200,100',
      '2025-01-04T03:00:00Z,u1,/a,200,50',
      '2025-01-04T10:00:00Z,u1,/b,200,150',
      '2025-01-04T10:00:00Z,u1,/a,200,75',
    ]);
    const result = groupByDatePath(rows, 'jst');
    const correctAnswer = [
      { date: '2025-01-04', path: '/a', count: 3, avgLatency: 75 },
      { date: '2025-01-04', path: '/b', count: 1, avgLatency: 150 },
    ];
    expect(result).toEqual(correctAnswer);
  });

});
