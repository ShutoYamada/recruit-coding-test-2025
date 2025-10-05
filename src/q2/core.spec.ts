import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

const agg = (lines: string[], opt = {}) =>
  aggregate(lines, {
    from: '2025-01-01',
    to: '2025-01-01',
    tz: 'jst',
    top: 10,
    ...opt,
  });

describe('Q2 core optimized', () => {
  // [C1] parseLines
  describe('parseLines', () => {
    it('skips broken rows', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/a,200,100',
        'broken,row,only,three',
      ]);
      expect(rows.length).toBe(1);
    });

    it('skips header / extra columns / non-numeric / invalid timestamp', () => {
      const rows = parseLines([
        'timestamp,userId,path,status,latencyMs',
        '2025-01-01T00:00:00Z,u1,/ok,200,100',
        '2025-01-01T00:00:00Z,u2,/bad,OK,100',
        '2025-01-01T00:00:00Z,u3,/bad,200,NaN',
        'not-a-time,u4,/bad,200,100',
        '2025-01-01T00:00:00Z,u5,/bad,200,100,EXTRA',
      ]);
      expect(rows).toEqual([
        {
          timestamp: '2025-01-01T00:00:00Z',
          userId: 'u1',
          path: '/ok',
          status: 200,
          latencyMs: 100,
        },
      ]);
    });
  });

  // [C2] 期間フィルタ
  it('filterByDate: inclusive boundaries', () => {
    const lines = [
      '2024-12-31T23:59:59.999Z,u0,/x,200,100',
      '2025-01-01T00:00:00.000Z,u1,/x,200,100',
      '2025-01-31T23:59:59.999Z,u2,/x,200,100',
      '2025-02-01T00:00:00.000Z,u3,/x,200,100',
    ];
    const out = agg(lines, { from: '2025-01-01', to: '2025-01-31' });
    expect(out.reduce((s, r) => s + r.count, 0)).toBe(2);
  });

  // [C3] Timezone handling
  describe('TZ conversion', () => {
    it('UTC→JST crossing day works', () => {
      const lines = [
        '2025-01-01T01:00:00Z,u1,/a,200,100',
        '2025-01-01T16:30:00Z,u2,/a,200,100',
      ];
      const out = agg(lines, { from: '2024-12-31', to: '2025-01-03', tz: 'jst' });
      expect(new Set(out.map(r => r.date))).toEqual(
        new Set(['2025-01-01', '2025-01-02'])
      );
    });

    it('UTC→ICT crossing day works', () => {
      const lines = [
        '2025-01-01T01:00:00Z,u1,/a,200,100',
        '2025-01-01T17:30:00Z,u2,/a,200,100',
      ];
      const out = agg(lines, { from: '2024-12-31', to: '2025-01-03', tz: 'ict' });
      expect(new Set(out.map(r => r.date))).toEqual(
        new Set(['2025-01-01', '2025-01-02'])
      );
    });
  });

  // [C4] Grouping & average
  it('groups correctly and averages rounded', () => {
    const lines = [
      '2025-01-03T10:00:00Z,u1,/a,200,100',
      '2025-01-03T10:10:00Z,u2,/a,200,101',
      '2025-01-03T10:20:00Z,u3,/a,200,102',
      '2025-01-03T11:00:00Z,u4,/b,200,100',
      '2025-01-03T11:10:00Z,u5,/b,200,101',
    ];
    const out = agg(lines, { from: '2025-01-03', to: '2025-01-03' });
    expect(out).toContainEqual({
      date: '2025-01-03',
      path: '/a',
      count: 3,
      avgLatency: 101,
    });
    expect(out).toContainEqual({
      date: '2025-01-03',
      path: '/b',
      count: 2,
      avgLatency: 101,
    });
  });

  // [C5] Ranking & tie-breaking
  it('Top-N by count desc / path asc', () => {
    const lines = [
      '2025-01-05T00:00:00Z,u1,/a,200,100',
      '2025-01-05T00:10:00Z,u2,/a,200,100',
      '2025-01-05T00:20:00Z,u3,/a,200,100',
      '2025-01-05T01:00:00Z,u4,/b,200,100',
      '2025-01-05T01:10:00Z,u5,/b,200,100',
      '2025-01-05T01:20:00Z,u6,/b,200,100',
      '2025-01-05T02:00:00Z,u7,/c,200,100',
      '2025-01-05T02:10:00Z,u8,/c,200,100',
      '2025-01-05T03:00:00Z,u9,/d,200,100',
    ];
    const out = agg(lines, { from: '2025-01-05', to: '2025-01-05', tz: 'ict', top: 2 });
    expect(out).toEqual([
      { date: '2025-01-05', path: '/a', count: 3, avgLatency: 100 },
      { date: '2025-01-05', path: '/b', count: 3, avgLatency: 100 },
    ]);
  });

  // [C6] Final deterministic order
  it('Final order: date ASC → count DESC → path ASC', () => {
    const lines = [
      '2025-01-01T00:00:00Z,u1,/b,200,100',
      '2025-01-01T00:10:00Z,u2,/b,200,100',
      '2025-01-01T00:20:00Z,u3,/a,200,100',
      '2025-01-01T00:30:00Z,u4,/a,200,100',
      '2025-01-01T01:00:00Z,u5,/c,200,100',
      '2025-01-02T00:00:00Z,u6,/c,200,100',
      '2025-01-02T00:10:00Z,u7,/c,200,100',
      '2025-01-02T00:20:00Z,u8,/c,200,100',
      '2025-01-02T01:00:00Z,u9,/a,200,100',
    ];
    const out = agg(lines, { from: '2025-01-01', to: '2025-01-02', top: 3 });
    expect(out).toEqual([
      { date: '2025-01-01', path: '/a', count: 2, avgLatency: 100 },
      { date: '2025-01-01', path: '/b', count: 2, avgLatency: 100 },
      { date: '2025-01-01', path: '/c', count: 1, avgLatency: 100 },
      { date: '2025-01-02', path: '/c', count: 3, avgLatency: 100 },
      { date: '2025-01-02', path: '/a', count: 1, avgLatency: 100 },
    ]);
  });

  // [C7] Large dataset performance
  it('Handles large data and per-date Top-N consistently', () => {
    const lines: string[] = [];
    const addDay = (date: string, prefix: string) => {
      for (let i = 0; i < 5000; i++) {
        const path = `${prefix}${String(i).padStart(4, '0')}`;
        const hits = i < 10 ? 5 : 1;
        for (let k = 0; k < hits; k++) {
          lines.push(`${date}T00:${String(k).padStart(2, '0')}:00Z,u,${path},200,100`);
        }
      }
    };
    addDay('2025-01-20', '/p');
    addDay('2025-01-21', '/q');

    const out = agg(lines, { from: '2025-01-20', to: '2025-01-21', tz: 'ict', top: 10 });
    const mk = (d: string, p: string) =>
      Array.from({ length: 10 }, (_, i) => ({
        date: d,
        path: `${p}${String(i).padStart(4, '0')}`,
        count: 5,
        avgLatency: 100,
      }));
    expect(out).toEqual([...mk('2025-01-20', '/p'), ...mk('2025-01-21', '/q')]);
  });

  // [C8] Misc
  describe('[C8] Misc edge cases', () => {
    it('top > path count returns all', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-01T00:10:00Z,u2,/a,200,100',
        '2025-01-01T01:00:00Z,u3,/b,200,100',
        '2025-01-01T02:00:00Z,u4,/c,200,100',
      ];
      const out = agg(lines, { top: 999 });
      expect(out.length).toBe(3);
    });

    it('top applied per date independently', () => {
      const lines = [
        '2025-01-01T00:00:00Z,u1,/a,200,100',
        '2025-01-01T00:10:00Z,u2,/a,200,100',
        '2025-01-01T01:00:00Z,u3,/b,200,100',
        '2025-01-02T00:00:00Z,u4,/c,200,100',
        '2025-01-02T00:10:00Z,u5,/c,200,100',
        '2025-01-02T01:00:00Z,u6,/d,200,100',
        '2025-01-02T02:00:00Z,u7,/e,200,100',
      ];
      const out = agg(lines, { from: '2025-01-01', to: '2025-01-02', top: 2 });
      expect(out.map(r => r.path)).toEqual(['/a', '/b', '/c', '/d']);
    });

    it('trims whitespace in a single line', () => {
      const lines = [' 2025-01-01T00:00:00Z , u1 , /a , 200 , 100 '];
      const out = agg(lines);
      expect(out).toEqual([
        { date: '2025-01-01', path: '/a', count: 1, avgLatency: 100 },
      ]);
    });
  });
});
