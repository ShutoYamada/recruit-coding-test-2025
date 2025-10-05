/* eslint-disable max-lines-per-function */
import { describe, expect, it } from 'vitest';
import { aggregate, parseLines } from './core.js';

// Q2: アクセスログ集計の単体テスト
// ----------------------------------
// parseLines() と aggregate() の動作確認。
// - CSVパース
// - 日付フィルタリング
// - タイムゾーン変換
// - 日付×パスの集計
// - トップN抽出
// - ソート順の検証
// ----------------------------------

describe('Q2 core', () => {
  // ============= 1. パーステスト =============
  describe('parseLines', () => {
    it('列不足など壊れた行をスキップする', () => {
      const rows = parseLines([
        '2025-01-03T10:12:00Z,u1,/a,200,100',
        'broken,row,only,three',
        'only,two',
        '',
      ]);
      expect(rows.length).toBe(1);
      expect(rows[0].path).toBe('/a');
    });

    it('余分な空白を許容して正しく読み取る', () => {
      const rows = parseLines([
        ' 2025-01-03T10:12:00Z , u1 , /api/test , 200 , 150 ',
      ]);
      expect(rows.length).toBe(1);
      expect(rows[0].timestamp).toBe('2025-01-03T10:12:00Z');
      expect(rows[0].userId).toBe('u1');
      expect(rows[0].path).toBe('/api/test');
    });

    it('数値フィールド(status, latency)を正しく変換する', () => {
      const rows = parseLines(['2025-01-03T10:12:00Z,u1,/a,404,250']);
      expect(rows[0].status).toBe(404);
      expect(rows[0].latencyMs).toBe(250);
    });
  });

  // ============= 2. 日付範囲フィルタリング =============
  describe('Date Range Filtering', () => {
    it('from日付の始まりを含める', () => {
      const lines = ['2025-01-03T00:00:00Z,u1,/api/test,200,100'];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });
      expect(res.length).toBe(1);
    });

    it('to日付の終わりを含める', () => {
      const lines = ['2025-01-05T23:59:59Z,u1,/api/test,200,100'];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });
      expect(res.length).toBe(1);
    });

    it('from以前のデータを除外する', () => {
      const lines = [
        '2025-01-02T23:59:59Z,u1,/api/test,200,100',
        '2025-01-03T00:00:00Z,u2,/api/test,200,100',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });
      expect(res.length).toBe(1);
      expect(res[0].count).toBe(1);
    });

    it('to以降のデータを除外する', () => {
      const lines = [
        '2025-01-05T23:59:59Z,u1,/api/test,200,100',
        '2025-01-06T00:00:00Z,u2,/api/test,200,100',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });
      expect(res.length).toBe(1);
      expect(res[0].count).toBe(1);
    });
  });

  // ============= 3. タイムゾーン変換テスト =============
  describe('Timezone Conversion', () => {
    it('UTC→JST変換(日付またぎ)', () => {
      // 2025-01-03T23:00:00Z = JSTでは翌日の08:00
      const lines = ['2025-01-03T23:00:00Z,u1,/api/test,200,100'];
      const res = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-10',
        tz: 'jst',
        top: 5,
      });
      expect(res[0].date).toBe('2025-01-04');
    });

    it('UTC→ICT変換', () => {
      // 2025-01-03T20:00:00Z = ICTでは翌日の03:00
      const lines = ['2025-01-03T20:00:00Z,u1,/api/test,200,100'];
      const res = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-10',
        tz: 'ict',
        top: 5,
      });
      expect(res[0].date).toBe('2025-01-04');
    });

    it('日付が変わらないケース(JST内)', () => {
      const lines = ['2025-01-03T10:00:00Z,u1,/api/test,200,100'];
      const res = aggregate(lines, {
        from: '2025-01-01',
        to: '2025-01-10',
        tz: 'jst',
        top: 5,
      });
      expect(res[0].date).toBe('2025-01-03');
    });
  });

  // ============= 4. 集計ロジックの検証 =============
  describe('Aggregation (date × path)', () => {
    it('countとavgLatencyを正しく計算する', () => {
      const lines = [
        '2025-01-03T10:12:00Z,u1,/api/orders,200,120',
        '2025-01-03T10:13:00Z,u2,/api/orders,200,180',
        '2025-01-03T11:00:00Z,u3,/api/users,200,90',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-04',
        tz: 'jst',
        top: 5,
      });

      const orders = res.find((r) => r.path === '/api/orders');
      expect(orders?.count).toBe(2);
      expect(orders?.avgLatency).toBe(150);
      const users = res.find((r) => r.path === '/api/users');
      expect(users?.count).toBe(1);
      expect(users?.avgLatency).toBe(90);
    });

    it('avgLatencyを四捨五入する', () => {
      const lines = [
        '2025-01-03T10:00:00Z,u1,/api/test,200,100',
        '2025-01-03T10:01:00Z,u2,/api/test,200,101',
        '2025-01-03T10:02:00Z,u3,/api/test,200,102',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-04',
        tz: 'jst',
        top: 5,
      });
      expect(res[0].avgLatency).toBe(101);
    });

    it('日付ごとに別パスとして集計する', () => {
      const lines = [
        '2025-01-03T10:00:00Z,u1,/api/test,200,100',
        '2025-01-04T10:00:00Z,u2,/api/test,200,200',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });
      expect(res.length).toBe(2);
      expect(res[0].date).toBe('2025-01-03');
      expect(res[1].date).toBe('2025-01-04');
    });
  });

  // ============= 5. トップN抽出テスト =============
  describe('Top N Ranking (per day)', () => {
    it('日ごとにcount順で上位N件を選ぶ', () => {
      const lines = [
        '2025-01-03T10:00:00Z,u1,/api/a,200,100',
        '2025-01-03T10:01:00Z,u1,/api/a,200,100',
        '2025-01-03T10:02:00Z,u1,/api/a,200,100',
        '2025-01-03T10:03:00Z,u1,/api/b,200,100',
        '2025-01-03T10:04:00Z,u1,/api/b,200,100',
        '2025-01-03T10:05:00Z,u1,/api/c,200,100',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-04',
        tz: 'jst',
        top: 2,
      });
      expect(res.length).toBe(2);
      expect(res[0].path).toBe('/api/a');
      expect(res[1].path).toBe('/api/b');
    });

    it('countが同じ場合はpath昇順で並ぶ', () => {
      const lines = [
        '2025-01-03T10:00:00Z,u1,/api/zebra,200,100',
        '2025-01-03T10:01:00Z,u1,/api/alpha,200,100',
        '2025-01-03T10:02:00Z,u1,/api/beta,200,100',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-04',
        tz: 'jst',
        top: 2,
      });
      expect(res[0].path).toBe('/api/alpha');
      expect(res[1].path).toBe('/api/beta');
    });

    it('日ごとに独立してトップNを適用', () => {
      const lines = [
        '2025-01-03T10:00:00Z,u1,/api/a,200,100',
        '2025-01-03T10:01:00Z,u1,/api/b,200,100',
        '2025-01-03T10:02:00Z,u1,/api/c,200,100',
        '2025-01-04T10:00:00Z,u1,/api/x,200,100',
        '2025-01-04T10:01:00Z,u1,/api/y,200,100',
        '2025-01-04T10:02:00Z,u1,/api/z,200,100',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 2,
      });
      expect(res.length).toBe(4);
    });
  });

  // ============= 6. 出力順の確認 =============
  describe('Final Output Ordering', () => {
    it('日付昇順→count降順→path昇順にソートされる', () => {
      const lines = [
        '2025-01-04T10:00:00Z,u1,/api/z,200,100',
        '2025-01-04T10:01:00Z,u1,/api/z,200,100',
        '2025-01-04T10:02:00Z,u1,/api/a,200,100',
        '2025-01-03T10:00:00Z,u1,/api/x,200,100',
        '2025-01-03T10:01:00Z,u1,/api/x,200,100',
        '2025-01-03T10:02:00Z,u1,/api/x,200,100',
        '2025-01-03T10:03:00Z,u1,/api/y,200,100',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 5,
      });
      expect(res[0].date).toBe('2025-01-03');
      expect(res[1].date).toBe('2025-01-03');
      expect(res[2].date).toBe('2025-01-04');
      expect(res[3].date).toBe('2025-01-04');
    });
  });

  // ============= 7. 総合テスト =============
  describe('Integration Tests', () => {
    it('README記載の例と一致する', () => {
      const lines = [
        '2025-01-03T10:12:00Z,u1,/api/orders,200,120',
        '2025-01-03T10:13:00Z,u2,/api/orders,200,180',
        '2025-01-03T11:00:00Z,u3,/api/users,200,90',
        '2025-01-04T00:10:00Z,u1,/api/orders,200,110',
      ];
      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-04',
        tz: 'jst',
        top: 3,
      });
      expect(res).toEqual([
        { date: '2025-01-03', path: '/api/orders', count: 2, avgLatency: 150 },
        { date: '2025-01-03', path: '/api/users', count: 1, avgLatency: 90 },
        { date: '2025-01-04', path: '/api/orders', count: 1, avgLatency: 110 },
      ]);
    });

    it('複数日・複数パスの大量データを処理できる', () => {
      const lines: string[] = [];
      for (let day = 3; day <= 5; day++) {
        for (let path = 1; path <= 5; path++) {
          const requestCount = 6 - path;
          for (let i = 0; i < requestCount; i++) {
            lines.push(
              `2025-01-0${day}T${String(8 + i).padStart(2, '0')}:00:00Z,u${i},/api/path${path},200,${100 + path * 10}`
            );
          }
        }
      }

      const res = aggregate(lines, {
        from: '2025-01-03',
        to: '2025-01-05',
        tz: 'jst',
        top: 3,
      });
      expect(res.length).toBe(9);
    });
  });
});
