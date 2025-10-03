import { describe, expect, it } from 'vitest';
import { parseLines } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken rows or invalid numbers', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
      '2025-01-03T10:13:00Z,u2,/b,200,abc',
      '2025-01-03T10:14:00Z,u3,/c,OK,150',
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].path).toBe('/a');
  });

  // it.todo('aggregate basic');
});
