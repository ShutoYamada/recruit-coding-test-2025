import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  it('parseLines: skips broken or invalid rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
      '2025-01-03T10:13:00Z,u2,/b,abc,90',
      '2025-01-03T10:14:00Z,u3,/c,200,xyz',
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0]).toEqual({
      timestamp: '2025-01-03T10:12:00Z',
      userId: 'u1',
      path: '/a',
      status: 200,
      latencyMs: 100,
    });
  });
});
