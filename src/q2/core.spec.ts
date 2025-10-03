import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  it.skip('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
    ]);
    expect(rows.length).toBe(1);
  });

  it.skip('parseLines: skips header, non-number, and too few cols', () => {
    const rows = parseLines([
      'timestamp,userId,path,status,latencyMs', // header
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      '2025-01-03T10:12:00Z,u1,/a,OK,100', // status not number
      '2025-01-03T10:12:00Z,u1,/a,200,NaN', // latency not number
      'bad-timestamp,u1,/a,200,100', // invalid time
      'broken,row,only,three', // thiếu cột
    ]);
    expect(rows.length).toBe(1);
  });

  it.skip('aggregate basic', () => {
    const lines = [
      '2025-01-01T00:00:00Z,u1,/a,200,100',
      '2025-01-01T12:00:00Z,u2,/a,200,300',
    ];
    const out = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-01',
      tz: 'jst',
      top: 5,
    });
    expect(out).toEqual([
      { date: '2025-01-01', path: '/a', count: 2, avgLatency: 200 },
    ]);
  });

  it.skip('tz: UTC→JST may shift to next day', () => {
    // 2025-01-01 15:30 UTC => JST +9 = 2025-01-02 00:30 (ngày sau)
    const lines = ['2025-01-01T15:30:00Z,u1,/a,200,100'];
    const out = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 5,
    });
    expect(out[0].date).toBe('2025-01-02');
  });

  it('topN per date, tie by path ASC; final sort date ASC, count DESC, path ASC', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/a,200,100',
      '2025-01-01T11:00:00Z,u2,/b,200,100',
      '2025-01-01T12:00:00Z,u3,/b,200,100',
      '2025-01-02T10:00:00Z,u4,/x,200,100',
      '2025-01-02T11:00:00Z,u5,/y,200,100',
      '2025-01-02T12:00:00Z,u6,/y,200,100',
    ];
    const out = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'ict',
      top: 1,
    });
    // Mỗi ngày chỉ 1 path nhiều request nhất: 2025-01-01 -> /b (2), 2025-01-02 -> /y (2)
    expect(out).toEqual([
      { date: '2025-01-01', path: '/b', count: 2, avgLatency: 100 },
      { date: '2025-01-02', path: '/y', count: 2, avgLatency: 100 },
    ]);
  });
});
