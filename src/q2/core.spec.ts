import { describe, expect, it } from 'vitest';
import { parseLines, aggregate, type Options } from './core.js';

describe('Q2 parseLines', () => {
  it('skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
    ]);
    expect(rows.length).toBe(1);
  });

  it('handles non-numeric values', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      '2025-01-03T10:13:00Z,u2,/b,notnum,50',  // invalid status
      '2025-01-03T10:14:00Z,u3,/c,404,invalid', // invalid latency
      '',  // empty line
      '   ',  // whitespace only
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].path).toBe('/a');
  });
});

describe('Q2 aggregate', () => {
  it('basic case', () => {
    const lines = [
      '2025-01-03T10:12:00Z,u1,/api/orders,200,120',
      '2025-01-03T10:13:00Z,u2,/api/orders,200,180',
      '2025-01-03T11:00:00Z,u3,/api/users,200,90',
    ];
    
    const options: Options = {
      from: '2025-01-01',
      to: '2025-01-31', 
      tz: 'jst',
      top: 5
    };
    
    const result = aggregate(lines, options);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2025-01-03',
      path: '/api/orders', 
      count: 2,
      avgLatency: 150  // (120+180)/2 = 150
    });
    expect(result[1]).toEqual({
      date: '2025-01-03',
      path: '/api/users',
      count: 1, 
      avgLatency: 90
    });
  });

  it('date filtering: boundary inclusion', () => {
    const lines = [
      '2025-01-01T00:00:00Z,u1,/a,200,100',  // exactly from boundary
      '2025-01-01T23:59:59Z,u2,/b,200,100',  // within from day  
      '2025-01-02T12:00:00Z,u3,/c,200,100',  // middle day
      '2025-01-03T23:59:59Z,u4,/d,200,100',  // exactly to boundary
      '2024-12-31T23:59:59Z,u5,/e,200,100',  // before range
      '2025-01-04T00:00:01Z,u6,/f,200,100',  // after range
    ];
    
    const options: Options = {
      from: '2025-01-01',
      to: '2025-01-03',
      tz: 'jst',
      top: 5
    };
    
    const result = aggregate(lines, options);
    
    // Should include exactly 4 rows (a,b,c,d) and exclude e,f
    expect(result).toHaveLength(4);
    const paths = result.map(r => r.path).sort();
    expect(paths).toEqual(['/a', '/b', '/c', '/d']);
  });

  it('timezone conversion: UTC to JST/ICT', () => {
    const lines = [
      '2025-01-02T15:00:00Z,u1,/a,200,100',  // UTC 15:00 = JST 00:00 next day, ICT 22:00 same day
      '2025-01-02T16:00:00Z,u2,/b,200,100',  // UTC 16:00 = JST 01:00 next day, ICT 23:00 same day  
      '2025-01-02T17:00:00Z,u3,/c,200,100',  // UTC 17:00 = JST 02:00 next day, ICT 00:00 next day
    ];
    
    // Test JST conversion
    const jstOptions: Options = {
      from: '2025-01-01',
      to: '2025-01-05', 
      tz: 'jst',
      top: 5
    };
    
    const jstResult = aggregate(lines, jstOptions);
    
    // In JST, all should be on 2025-01-03 (next day from UTC)
    expect(jstResult.every(r => r.date === '2025-01-03')).toBe(true);
    
    // Test ICT conversion  
    const ictOptions: Options = {
      from: '2025-01-01',
      to: '2025-01-05',
      tz: 'ict', 
      top: 5
    };
    
    const ictResult = aggregate(lines, ictOptions);
    
    // In ICT, first two should be 2025-01-02, third should be 2025-01-03
    const ictDates = ictResult.map(r => r.date);
    expect(ictDates.filter(d => d === '2025-01-02')).toHaveLength(2);  // /a, /b
    expect(ictDates.filter(d => d === '2025-01-03')).toHaveLength(1);  // /c
  });

  it.todo('aggregation: multiple days and paths');
  it.todo('ranking: per-date top N with ties');
  it.todo('output sorting: date ASC, count DESC, path ASC');
});
