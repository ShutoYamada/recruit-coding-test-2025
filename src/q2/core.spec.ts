/* eslint-disable max-lines-per-function */
import { describe, expect, it } from 'vitest';
import { filterByDate, parseLines, toTZDate, groupByDatePath, rankTop, aggregate } from './core.js';

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
   * filterByDate tests
   * -----------------
   */
  it('filterByDate: keeps only rows within inclusive date range', () => {
    const rows = parseLines([
      '2025-01-01T00:00:00Z,u1,/a,200,100', // boundary start
      '2025-01-02T10:00:00Z,u2,/b,200,150', // inside range
      '2025-01-03T23:59:59Z,u3,/c,200,200', // boundary end
      '2025-01-04T00:00:00Z,u4,/d,200,250', // out of range
    ])

    const filtered = filterByDate(rows, '2025-01-01', '2025-01-03')

    expect(filtered.length).toBe(3);
    expect(filtered.map((r) => r.path)).toEqual(['/a', '/b', '/c'])
  })

  /**
   * -----------------
   * toTZDate tests
   * -----------------
   */
  it('toTZDate: converts UTC to JST correctly (UTC+9)', () => {
    // UTC 2025-01-01 18:00 -> JST 2025-01-02
    const date = toTZDate('2025-01-01T18:00:00Z', 'jst')
    expect(date).toBe('2025-01-02')
  });

  it('toTZDate: converts UTC to ICT correctly (UTC+7)', () => {
    // UTC 2025-01-01 20:00 -> ICT 2025-01-02
    const date = toTZDate('2025-01-01T20:00:00Z', 'ict')
    expect(date).toBe('2025-01-02')
  });

  /**
   * -----------------------
   * groupByDatePath tests
   * -----------------
   */
  it('groupByDatePath: groups rows by date and path with avg latency', () => {
    const rows = parseLines([
      '2025-01-03T10:00:00Z,u1,/api/orders,200,100',
      '2025-01-03T11:00:00Z,u2,/api/orders,200,200',
      '2025-01-03T12:00:00Z,u3,/api/users,200,150',
      '2025-01-04T01:00:00Z,u4,/api/orders,200,120',
    ])

    const grouped = groupByDatePath(rows, 'jst')

    const orders0303 = grouped.find(
      (g) => g.date === '2025-01-03' && g.path === '/api/orders'
    )
    expect(orders0303?.count).toBe(2)
    expect(orders0303?.avgLatency).toBe(150) // (100+200)/2

    const users0303 = grouped.find(
      (g) => g.date === '2025-01-03' && g.path === '/api/users'
    )
    expect(users0303?.count).toBe(1)
    expect(users0303?.avgLatency).toBe(150)

    const orders0404 = grouped.find(
      (g) => g.date === '2025-01-04' && g.path === '/api/orders'
    );
    expect(orders0404?.count).toBe(1);
    expect(orders0404?.avgLatency).toBe(120)
  })

  /**
   * -----------------
   * rankTop tests
   * -----------------
   */
  it('rankTop: selects top N per date and sorts output', () => {
    const items = [
      { date: '2025-01-01', path: '/b', count: 10, avgLatency: 100 },
      { date: '2025-01-01', path: '/a', count: 10, avgLatency: 120 },
      { date: '2025-01-01', path: '/c', count: 5, avgLatency: 130 },
      { date: '2025-01-02', path: '/z', count: 20, avgLatency: 200 },
      { date: '2025-01-02', path: '/y', count: 15, avgLatency: 180 },
      { date: '2025-01-02', path: '/x', count: 15, avgLatency: 170 },
    ]

    const ranked = rankTop(items, 2)
    expect(ranked.length).toBe(4)

    expect(ranked.filter(r => r.date === '2025-01-01').map(r => r.path)).toEqual(['/a', '/b']) // /a before /b due to avgLatency

    expect(ranked.filter(r => r.date === '2025-01-02').map(r => r.path)).toEqual(['/z', '/x']) // sorted by count desc
  })

  /**-----------------
   * aggregate tests
   * -----------------
   */
  it('aggregate: end-to-end basic flow', () => {
    const lines = [
      '2025-01-01T10:00:00Z,u1,/api/orders,200,100',
      '2025-01-01T11:00:00Z,u2,/api/orders,200,200',
      '2025-01-01T12:00:00Z,u3,/api/users,200,150',
      '2025-01-02T09:00:00Z,u4,/api/orders,200,120',
      '2025-01-02T10:00:00Z,u5,/api/orders,200,180',
      '2025-01-02T11:00:00Z,u6,/api/users,200,90',
    ]

    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-02',
      tz: 'jst',
      top: 2,
    });

    // 2025-01-01 JST -> /api/orders (2 calls, avg=150), /api/users (1 call, avg=150)
    // 2025-01-02 JST -> /api/orders (2 calls, avg=150), /api/users (1 call, avg=90)

    expect(result).toEqual([
      { date: '2025-01-01', path: '/api/orders', count: 2, avgLatency: 150 },
      { date: '2025-01-01', path: '/api/users', count: 1, avgLatency: 150 },
      { date: '2025-01-02', path: '/api/orders', count: 2, avgLatency: 150 },
      { date: '2025-01-02', path: '/api/users', count: 1, avgLatency: 90 },
    ])
  })

  // it.todo('aggregate basic');
});
