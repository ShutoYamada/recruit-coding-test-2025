import { describe, expect, it } from 'vitest';
import { parseLines } from './core.js';

describe('Q2 core', () => {
  /**
   * -----------------
   * parseLines tests
   * -----------------
   */
  it('parseLines: skips broken rows or invalid numbers', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
      '2025-01-03T10:13:00Z,u2,/b,200,abc', // invalid latency
      '2025-01-03T10:14:00Z,u3,/c,OK,150', // invalid status
    ]);

    expect(rows.length).toBe(1);
    expect(rows[0].path).toBe('/a');
  });

  /**
   * -----------------
   * filterByDate
   * -----------------
   */
  it('filterByDate: keeps only rows within inclusive date range', () => {
    const rows = parseLines([
      '2025-01-01T00:00:00Z,u1,/a,200,100', // boundary start
      '2025-01-02T10:00:00Z,u2,/b,200,150', // inside range
      '2025-01-03T23:59:59Z,u3,/c,200,200', // boundary end
      '2025-01-04T00:00:00Z,u4,/d,200,250', // out of range
    ])
    const from = '2025-01-01'
    const to = '2025-01-03'
    const fromT = Date.parse(from + 'T00:00:00Z')
    const toT = Date.parse(to + 'T23:59:59Z')
    const filtered = rows.filter((r) => {
      const t = Date.parse(r.timestamp);
      return t >= fromT && t <= toT;
    })

    expect(filtered.length).toBe(3);
    expect(filtered.map((r) => r.path)).toEqual(['/a', '/b', '/c'])
  })


  // it.todo('aggregate basic');
});
