import { describe, expect, it } from 'vitest';
import { parseLines, filterByDate, toTZDate, groupByDatePath } from './core.js';

describe('Q2 core', () => {
  // parseLines: skip invalid rows
  // 無効な行をスキップすること
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      '2025-01-03T10:12:00Z,u1,/a,200,100',
      'broken,row,only,three',
      '2025-01-03T10:15:00Z,u2,/b,404,xyz',
      '2025-01-03T10:20:00Z,u3,/c,xyz,300',
      'abx,u4,/d,500,400',
      'timestamp,u5,/e,600,500',
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].userId).toBe('u1');
  });


  // filterByDate: filter rows by date range
  // 日付範囲でフィルターすること
  it('dateFiltering: filters by date range', () => {
    const input = [
      '2025-01-01T23:59:59Z,u1,/a,200,100',
      '2025-01-02T00:00:00Z,u2,/b,200,100',
      '2025-01-15T12:00:00Z,u3,/c,200,100',
      '2025-01-31T23:59:59Z,u4,/d,200,100',
      '2025-02-01T00:00:00Z,u5,/e,200,100',
    ]
    const rows = parseLines(input);
    const filtered = filterByDate(rows, '2025-01-02', '2025-01-31');
    expect(filtered.length).toBe(3);
    expect(filtered[0].userId).toBe('u2');
    expect(filtered[2].userId).toBe('u4');
  });

  // toTZDate: convert UTC → JST/ICT
  // UTC日時をタイムゾーンに変換する
  it('toTZDate: converts UTC to local date', () => {
    const input = [
      '2025-01-01T15:00:00Z', 
      '2025-01-01T16:00:00Z', 
      '2025-01-02T14:59:59Z', 
      '2025-01-02T15:00:00Z', 
    ];
    const jst = input.map((t) => toTZDate(t, 'jst'));
    const ict = input.map((t) => toTZDate(t, 'ict'));
    expect(jst).toEqual([
      '2025-01-02',
      '2025-01-02',
      '2025-01-02',
      '2025-01-03',
    ]);
    expect(ict).toEqual([
      '2025-01-01',
      '2025-01-01',
      '2025-01-02',
      '2025-01-02',
    ]);
  });

  // groupByDatePath: group logs by (date, path)
  // 日付とパスごとにグループ化して平均レイテンシを計算
  it('groupByDatePath: groups by date and path with count and avgLatency', () => {
    const input = [
      '2025-01-01T15:00:00Z,u1,/a,200,100', 
      '2025-01-01T16:00:00Z,u2,/a,200,300', 
      '2025-01-02T14:59:59Z,u3,/b,200,200', 
      '2025-01-02T15:00:00Z,u4,/a,200,400', 
    ];
    const rows = parseLines(input);
    const grouped = groupByDatePath(rows, 'jst');
    expect(grouped).toEqual([
      { date: "2025-01-02", path: "/a", count: 2, avgLatency: 200 },
      { date: "2025-01-02", path: "/b", count: 1, avgLatency: 200 },
      { date: "2025-01-03", path: "/a", count: 1, avgLatency: 400 },
    ]);
  });

  it.todo('aggregate basic');
});
