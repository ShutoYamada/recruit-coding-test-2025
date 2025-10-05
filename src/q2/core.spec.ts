import { describe, expect, it } from 'vitest';
import { parseLines, aggregate } from './core.js';

describe('Q2 core', () => {
  // ===============================
  // [T1] CSV Parsing Tests
  // ===============================
  it('parseLines: skips broken rows', () => {
    const rows = parseLines([
      'timestamp,userId,path,status,latencyMs', // header
      '2025-01-03T10:12:00Z,u1,/api/orders,200,100', // valid
      'broken,row,only,three', // 不足カラム
      '2025-01-03T11:00:00Z,u2,/api/users,invalid,90', // 非数値status
      '2025-01-03T12:00:00Z,u3,/api/orders,200,invalid', // 非数値latency
      'invalid-timestamp,u4,/api/test,200,50', // 不正timestamp
      '', // 空行
      '2025-01-03T13:00:00Z,u5,/api/users,404,75', // valid
    ]);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({
      timestamp: '2025-01-03T10:12:00Z',
      userId: 'u1',
      path: '/api/orders',
      status: 200,
      latencyMs: 100
    });
  });

  // ===============================
  // [T2] Date Filtering Tests  
  // ===============================
  it('aggregate: date filtering with boundaries', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2024-12-31T23:59:59Z,u1,/api/old,200,100', // before range
      '2025-01-01T00:00:00Z,u1,/api/start,200,110', // start boundary
      '2025-01-02T12:00:00Z,u1,/api/middle,200,120', // within range
      '2025-01-03T23:59:59Z,u1,/api/end,200,130', // end boundary
      '2025-01-04T00:00:00Z,u1,/api/after,200,140', // after range
    ];
    
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-03', 
      tz: 'jst',
      top: 10
    });
    
    // Should include start, middle, end (3 records)
    expect(result.length).toBe(3);
    
    // Verify correct paths are included (order doesn't matter for this test)
    const paths = result.map(r => r.path).sort();
    expect(paths).toEqual(['/api/end', '/api/middle', '/api/start']);
  });

  // ===============================
  // [T3] Timezone Conversion Tests
  // ===============================
  it('aggregate: timezone conversion JST', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T14:00:00Z,u1,/api/test,200,100', // UTC 14:00 = JST 23:00 (same day)
      '2025-01-03T15:30:00Z,u1,/api/test,200,110', // UTC 15:30 = JST 00:30+1 (next day)
    ];
    
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-05',
      tz: 'jst',
      top: 10
    });
    
    // Should have 2 different dates due to timezone conversion
    expect(result.length).toBe(2);
    expect(result[0].date).toBe('2025-01-03');
    expect(result[1].date).toBe('2025-01-04');
  });

  it('aggregate: timezone conversion ICT', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T16:00:00Z,u1,/api/test,200,100', // UTC 16:00 = ICT 23:00 (same day)
      '2025-01-03T17:30:00Z,u1,/api/test,200,110', // UTC 17:30 = ICT 00:30+1 (next day)
    ];
    
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-05',
      tz: 'ict',
      top: 10
    });
    
    // Should have 2 different dates due to timezone conversion
    expect(result.length).toBe(2);
    expect(result[0].date).toBe('2025-01-03');
    expect(result[1].date).toBe('2025-01-04');
  });

  // ===============================
  // [T4] Aggregation Tests
  // ===============================
  it('aggregate: count and average latency calculation', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T10:00:00Z,u1,/api/orders,200,100',
      '2025-01-03T10:05:00Z,u2,/api/orders,200,200', // same path
      '2025-01-03T10:10:00Z,u3,/api/users,200,300',  // different path
      '2025-01-03T10:15:00Z,u4,/api/orders,200,150', // same path again
    ];
    
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-05',
      tz: 'jst',
      top: 10
    });
    
    expect(result.length).toBe(2);
    
    // /api/orders: count=3, avg=(100+200+150)/3=150
    const orders = result.find(r => r.path === '/api/orders');
    expect(orders?.count).toBe(3);
    expect(orders?.avgLatency).toBe(150);
    
    // /api/users: count=1, avg=300
    const users = result.find(r => r.path === '/api/users');
    expect(users?.count).toBe(1);
    expect(users?.avgLatency).toBe(300);
  });

  it('aggregate: average latency rounding', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T10:00:00Z,u1,/api/test,200,100',
      '2025-01-03T10:05:00Z,u2,/api/test,200,101', // avg = 100.5 -> 101
    ];
    
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-05',
      tz: 'jst',
      top: 10
    });
    
    expect(result[0].avgLatency).toBe(101); // Math.round(100.5) = 101
  });

  // ===============================
  // [T5] Top-N Ranking Tests
  // ===============================
  it('aggregate: top-N ranking per date', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      // Date 1: 3 paths with different counts
      '2025-01-03T10:00:00Z,u1,/api/a,200,100',
      '2025-01-03T10:01:00Z,u1,/api/a,200,100', // /api/a: count=2
      '2025-01-03T10:02:00Z,u1,/api/b,200,100',
      '2025-01-03T10:03:00Z,u1,/api/b,200,100',
      '2025-01-03T10:04:00Z,u1,/api/b,200,100', // /api/b: count=3 (highest)
      '2025-01-03T10:05:00Z,u1,/api/c,200,100', // /api/c: count=1
      
      // Date 2: 2 paths  
      '2025-01-04T10:00:00Z,u1,/api/x,200,100', // /api/x: count=1
      '2025-01-04T10:01:00Z,u1,/api/y,200,100',
      '2025-01-04T10:02:00Z,u1,/api/y,200,100', // /api/y: count=2
    ];
    
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-05',
      tz: 'jst',
      top: 2 // Only top 2 per date
    });
    
    // Should have 4 results: top 2 from each date
    expect(result.length).toBe(4);
    
    // Date 2025-01-03: /api/b (count=3), /api/a (count=2) - /api/c excluded
    const jan03 = result.filter(r => r.date === '2025-01-03');
    expect(jan03.length).toBe(2);
    expect(jan03[0].path).toBe('/api/b'); // highest count
    expect(jan03[0].count).toBe(3);
    expect(jan03[1].path).toBe('/api/a'); // second highest
    expect(jan03[1].count).toBe(2);
    
    // Date 2025-01-04: /api/y (count=2), /api/x (count=1)  
    const jan04 = result.filter(r => r.date === '2025-01-04');
    expect(jan04.length).toBe(2);
    expect(jan04[0].path).toBe('/api/y');
    expect(jan04[0].count).toBe(2);
    expect(jan04[1].path).toBe('/api/x');
    expect(jan04[1].count).toBe(1);
  });

  it('aggregate: tie-breaking by path name', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T10:00:00Z,u1,/api/zebra,200,100', // same count
      '2025-01-03T10:01:00Z,u1,/api/alpha,200,100', // same count, should come first
    ];
    
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-05',
      tz: 'jst',
      top: 10
    });
    
    // Same count, should order by path name (alpha < zebra)
    expect(result.length).toBe(2);
    expect(result[0].path).toBe('/api/alpha');
    expect(result[1].path).toBe('/api/zebra');
  });

  // ===============================
  // [T6] Final Sorting Tests
  // ===============================
  it('aggregate: final output sorting', () => {
    const lines = [
      'timestamp,userId,path,status,latencyMs',
      // Create data across multiple dates with various counts
      '2025-01-05T10:00:00Z,u1,/api/high,200,100',
      '2025-01-05T10:01:00Z,u1,/api/high,200,100',
      '2025-01-05T10:02:00Z,u1,/api/high,200,100', // count=3
      '2025-01-05T10:03:00Z,u1,/api/low,200,100',  // count=1
      
      '2025-01-03T10:00:00Z,u1,/api/med,200,100',
      '2025-01-03T10:01:00Z,u1,/api/med,200,100',  // count=2
      '2025-01-03T10:02:00Z,u1,/api/single,200,100', // count=1
    ];
    
    const result = aggregate(lines, {
      from: '2025-01-01',
      to: '2025-01-10',
      tz: 'jst',
      top: 10
    });
    
    // Final sort: date ASC, count DESC, path ASC
    expect(result.length).toBe(4);
    
    // 2025-01-03 comes first (date ASC)
    expect(result[0].date).toBe('2025-01-03');
    expect(result[0].path).toBe('/api/med'); // count=2 > count=1
    expect(result[0].count).toBe(2);
    
    expect(result[1].date).toBe('2025-01-03');
    expect(result[1].path).toBe('/api/single'); // count=1
    expect(result[1].count).toBe(1);
    
    // 2025-01-05 comes next (date ASC)
    expect(result[2].date).toBe('2025-01-05');
    expect(result[2].path).toBe('/api/high'); // count=3 > count=1
    expect(result[2].count).toBe(3);
    
    expect(result[3].date).toBe('2025-01-05');
    expect(result[3].path).toBe('/api/low'); // count=1
    expect(result[3].count).toBe(1);
  });
});
