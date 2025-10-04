import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

describe('Q2 core', () => {
  describe('parseLines', () => {
    it('should parse valid lines correctly', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:13:00Z,u2,/api/users,404,250',
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/api/orders',
        status: 200,
        latencyMs: 100,
      });
      expect(rows[1]).toEqual({
        timestamp: '2025-01-03T10:13:00Z',
        userId: 'u2',
        path: '/api/users',
        status: 404,
        latencyMs: 250,
      });
    });

    it('should skip lines with insufficient fields', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        'broken,row,only,three',
        'incomplete,line',
        'single',
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe('u1');
    });

    it('should skip lines with non-numeric status or latencyMs', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:13:00Z,u2,/api/users,invalid,250',
        '2025-01-03T10:14:00Z,u3,/api/orders,200,invalid',
        '2025-01-03T10:15:00Z,u4,/api/users,abc,def',
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe('u1');
    });

    it('should skip header line', () => {
      const rows = parseLines([
        'timestamp,userId,path,status,latencyMs',
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '2025-01-03T10:13:00Z,u2,/api/users,404,250',
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0].userId).toBe('u1');
      expect(rows[1].userId).toBe('u2');
    });

    it('should skip empty and whitespace-only lines', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        '',
        '   ',
        '2025-01-03T10:13:00Z,u2,/api/users,404,250',
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0].userId).toBe('u1');
      expect(rows[1].userId).toBe('u2');
    });

    it('should trim whitespace from fields', () => {
      const rows = parseLines([
        ' 2025-01-03T10:12:00Z , u1 , /api/orders , 200 , 100 ',
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        timestamp: '2025-01-03T10:12:00Z',
        userId: 'u1',
        path: '/api/orders',
        status: 200,
        latencyMs: 100,
      });
    });

    it('should skip lines with missing required fields', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/api/orders,200,100',
        ',u2,/api/users,404,250',
        '2025-01-03T10:13:00Z,,/api/orders,200,150',
        '2025-01-03T10:14:00Z,u3,,404,200',
        '2025-01-03T10:15:00Z,u4,/api/users,,300',
        '2025-01-03T10:16:00Z,u5,/api/orders,200,',
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe('u1');
    });
  });

  describe('filterByDate (via aggregate)', () => {
    it('should include dates exactly matching from/to boundaries (UTC filtering)', () => {
      const result = aggregate([
        '2025-01-01T10:00:00Z,u1,/api/test,200,100',
        '2024-12-31T23:59:59Z,u2,/api/test,200,150',
        '2025-01-03T12:00:00Z,u3,/api/test,200,200',
        '2025-01-05T23:59:59Z,u4,/api/test,200,250',
        '2025-01-06T00:00:01Z,u5,/api/test,200,300',
        '2025-01-02T08:30:00Z,u6,/api/test,200,175',
      ], {
        from: '2025-01-01',
        to: '2025-01-05',
        tz: 'jst',
        top: 10
      });


      expect(result).toHaveLength(4);

      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-06']);
    });    it('should exclude dates before from boundary', () => {
      const result = aggregate([
        '2024-12-31T23:59:59Z,u1,/api/test,200,100',
        '2025-01-01T00:00:00Z,u2,/api/test,200,150',
        '2025-01-02T12:00:00Z,u3,/api/test,200,200',
      ], {
        from: '2025-01-01',
        to: '2025-01-31',
        tz: 'jst',
        top: 10
      });

      expect(result).toHaveLength(2);
      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-01', '2025-01-02']);
    });

    it('should exclude dates after to boundary (UTC filtering)', () => {
      const result = aggregate([
        '2025-01-03T12:00:00Z,u1,/api/test,200,100',
        '2025-01-05T23:59:59Z,u2,/api/test,200,150',
        '2025-01-06T00:00:01Z,u3,/api/test,200,200',
      ], {
        from: '2025-01-01',
        to: '2025-01-05',
        tz: 'jst',
        top: 10
      });

      expect(result).toHaveLength(2);
      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-03', '2025-01-06']);
    });

    it('should include dates within the range (UTC filtering)', () => {
      const result = aggregate([
        '2025-01-02T08:00:00Z,u1,/api/test,200,100',
        '2025-01-03T12:00:00Z,u2,/api/test,200,150',
        '2025-01-04T16:00:00Z,u3,/api/test,200,200',
      ], {
        from: '2025-01-01',
        to: '2025-01-05',
        tz: 'jst',
        top: 10
      });

      expect(result).toHaveLength(3);
      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-02', '2025-01-03', '2025-01-05']);
    });    it('should handle edge case: same from and to date', () => {
      const result = aggregate([
        '2025-01-02T23:59:59Z,u1,/api/test,200,100',
        '2025-01-03T08:00:00Z,u2,/api/test,200,150',
        '2025-01-03T16:00:00Z,u3,/api/test,200,200',
        '2025-01-04T00:00:01Z,u4,/api/test,200,250',
      ], {
        from: '2025-01-03',
        to: '2025-01-03',
        tz: 'jst',
        top: 10
      });

      expect(result).toHaveLength(2);
      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-03', '2025-01-04']);
    });

    it('should demonstrate UTC filtering vs JST grouping behavior', () => {
      const result = aggregate([
        '2025-01-02T15:00:00Z,u1,/api/test,200,100',
        '2025-01-02T14:59:59Z,u2,/api/test,200,150',
      ], {
        from: '2025-01-02',
        to: '2025-01-02',
        tz: 'jst',
        top: 10
      });


      expect(result).toHaveLength(2);
      const dates = result.map(r => r.date).sort();
      expect(dates).toEqual(['2025-01-02', '2025-01-03']);
    });
  });

  describe('timezone conversion and grouping', () => {
    it('should group by (date, path) correctly', () => {
      // (date, path)ペアによるグルーピングとavgLatency計算のテスト
      const result = aggregate([
        '2025-01-02T10:00:00Z,u1,/api/orders,200,100',
        '2025-01-02T11:00:00Z,u2,/api/orders,200,200',  
        '2025-01-02T12:00:00Z,u3,/api/users,200,150',
        '2025-01-02T13:00:00Z,u4,/api/orders,200,300',  // 最初の2つと同じpath
        '2025-01-03T10:00:00Z,u5,/api/orders,200,400',  // 同じpath、異なる日付
      ], {
        from: '2025-01-02',
        to: '2025-01-03',
        tz: 'jst', 
        top: 10
      });

      expect(result).toHaveLength(3);
      
      // 特定のグループを検索
      const jan2Orders = result.find(r => r.date === '2025-01-02' && r.path === '/api/orders');
      const jan2Users = result.find(r => r.date === '2025-01-02' && r.path === '/api/users'); 
      const jan3Orders = result.find(r => r.date === '2025-01-03' && r.path === '/api/orders');
      
      // グルーピングが正しいことを確認
      expect(jan2Orders).toBeDefined();
      expect(jan2Orders!.count).toBe(3); // u1, u2, u4
      expect(jan2Orders!.avgLatency).toBe(200); // Math.round((100+200+300)/3) = 200
      
      expect(jan2Users).toBeDefined();
      expect(jan2Users!.count).toBe(1); // u3 
      expect(jan2Users!.avgLatency).toBe(150);
      
      expect(jan3Orders).toBeDefined();
      expect(jan3Orders!.count).toBe(1); // u5
      expect(jan3Orders!.avgLatency).toBe(400);
    });

    it('should handle timezone boundary cases correctly', () => {
      // タイムゾーン変換の境界ケースのテスト
      const result = aggregate([
        // JST境界ケース
        '2025-01-01T14:59:59Z,u1,/api/test,200,100', // UTC 14:59 = JST 23:59 (2025-01-01)
        '2025-01-01T15:00:00Z,u2,/api/test,200,150', // UTC 15:00 = JST 00:00 (2025-01-02) 
        '2025-01-01T15:00:01Z,u3,/api/test,200,200', // UTC 15:00:01 = JST 00:00:01 (2025-01-02)
      ], {
        from: '2025-01-01',
        to: '2025-01-02', 
        tz: 'jst',
        top: 10
      });

      expect(result).toHaveLength(2);
      
      const jan1Group = result.find(r => r.date === '2025-01-01');
      const jan2Group = result.find(r => r.date === '2025-01-02');
      
      expect(jan1Group).toBeDefined();
      expect(jan1Group!.count).toBe(1); // u1のみ
      
      expect(jan2Group).toBeDefined(); 
      expect(jan2Group!.count).toBe(2); // u2とu3
    });

    it('should handle cross-year timezone conversion', () => {
      // 年をまたぐタイムゾーン変換のテスト
      const result = aggregate([
        '2024-12-31T14:59:59Z,u1,/api/test,200,100', // UTC 14:59 2024 = JST 23:59 2024
        '2024-12-31T15:00:00Z,u2,/api/test,200,150', // UTC 15:00 2024 = JST 00:00 2025
      ], {
        from: '2024-12-31',
        to: '2025-01-01',
        tz: 'jst',
        top: 10
      });

      expect(result).toHaveLength(2);
      
      const dec31Group = result.find(r => r.date === '2024-12-31');
      const jan1Group = result.find(r => r.date === '2025-01-01');
      
      expect(dec31Group).toBeDefined();
      expect(dec31Group!.count).toBe(1);
      
      expect(jan1Group).toBeDefined();
      expect(jan1Group!.count).toBe(1);
    });

    it('should calculate avgLatency correctly with rounding', () => {
      // 四捨五入を含むavgLatency計算のテスト
      const result = aggregate([
        '2025-01-02T10:00:00Z,u1,/api/test,200,100',
        '2025-01-02T11:00:00Z,u2,/api/test,200,110',
        '2025-01-02T12:00:00Z,u3,/api/test,200,105',
      ], {
        from: '2025-01-02', 
        to: '2025-01-02',
        tz: 'jst',
        top: 10
      });

      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(3);
      expect(result[0].avgLatency).toBe(105); // Math.round((100+110+105)/3) = Math.round(315/3) = Math.round(105) = 105
    });
  });

  it.todo('aggregate basic');
});
