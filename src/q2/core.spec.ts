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

  it('aggregate: filters rows within from/to inclusive', () => {
    const lines = [
      '2025-01-01T00:00:00Z,u1,/x,200,100',
      '2025-01-02T12:00:00Z,u2,/x,200,200',
      '2025-01-03T23:59:59Z,u3,/x,200,300',
      '2025-01-04T00:00:00Z,u4,/x,200,400',
    ];
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-03',
      tz: 'jst',
      top: 10,
    });
    const counts = result.reduce((sum, r) => sum + r.count, 0);
    expect(counts).toBe(3);
  });

  it('aggregate: converts UTC → JST/ICT correctly (day shift)', () => {
    const lines = [
      '2025-01-01T15:30:00Z,u1,/a,200,100',
      '2025-01-01T17:30:00Z,u2,/a,200,200',
    ];

    const jst = aggregate([lines[0]], {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 5,
    });
    const ict = aggregate([lines[1]], {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'ict',
      top: 5,
    });

    expect(jst[0].date).toBe('2025-01-02');
    expect(ict[0].date).toBe('2025-01-02');
  });
});
