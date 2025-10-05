/* eslint-disable max-lines-per-function */
import { describe, it, expect } from 'vitest';
import { aggregate } from './core.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// ヘルパ: 一時CSV作成
async function writeCsv(lines: string[]): Promise<string> {
  const file = path.join(os.tmpdir(), `q2_${Date.now()}_${Math.random()}.csv`);
  await fs.writeFile(file, lines.join('\n'), 'utf8');
  return file;
}

describe('Q2 aggregate – README要件', () => {
  it('[Parse] 壊れた行はスキップ（欠損/非数）', async () => {
    const csv = await writeCsv([
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T10:12:00Z,u1,/api/a,200,100',
      'badline',                                           // 壊れた行
      '2025-01-03T10:12:00Z,u2,/api/a,xxx,120',           // status 非数 → スキップ
      '2025-01-03T10:12:00Z,u3,/api/a,200,NaN',           // latency 非数 → スキップ
    ]);
    const out = await aggregate({ filePath: csv, tz: 'jst', from: '2025-01-01', to: '2025-01-31' });
    expect(out).toEqual([
      { date: '2025-01-03', path: '/api/a', count: 1, avgLatency: 100 }
    ]);
  });

  it('[Range] from/to はUTC基準・両端含む', async () => {
    // UTCの範囲 [2025-01-01T00:00Z, 2025-01-31T23:59:59Z] に入る2件を用意。
    // JSTに変換すると 1/1 と 2/1 に分かれるが、集計は「date×path」なので
    // 1行にまとまらず、/api/a の合計 count が 2 であることを検証する。
    const csv = await writeCsv([
      'timestamp,userId,path,status,latencyMs',
      '2025-01-01T00:00:00Z,u1,/api/a,200,100',  // = from
      '2025-01-31T23:59:59Z,u2,/api/a,200,200',  // = to (UTC内)
      '2025-02-01T00:00:00Z,u3,/api/a,200,300',  // 範囲外
    ]);
    const out = await aggregate({ filePath: csv, tz: 'jst', from: '2025-01-01', to: '2025-01-31' });
    // 修正点: 1行で count=2 を期待せず、「/api/a の行の合計 count が 2」であることを確認
    const total = out
      .filter(r => r.path === '/api/a')
      .reduce((n, r) => n + r.count, 0);
    expect(total).toBe(2);
  });

  it('[TZ] UTC→JST/ICT の日付変換で日付跨ぎが合う', async () => {
    // 異なる path を使い、JST/ICT での日付を個別に検証する。
    const csv = await writeCsv([
      'timestamp,userId,path,status,latencyMs',
      '2025-01-01T15:30:00Z,u1,/api/a,200,100', // JST=+9 → 2025-01-02
      '2025-01-01T00:30:00Z,u2,/api/b,200,100', // ICT=+7 → 2025-01-01
    ]);
    const jst = await aggregate({ filePath: csv, tz: 'jst' });
    const ict = await aggregate({ filePath: csv, tz: 'ict' });
    expect(jst.find(r => r.path === '/api/a')!.date).toBe('2025-01-02'); // 15:30Z +9h → 翌日
    expect(ict.find(r => r.path === '/api/b')!.date).toBe('2025-01-01'); // 00:30Z +7h → 同日
  });

  it('[Group] date×path 集計・平均は四捨五入', async () => {
    const csv = await writeCsv([
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T10:00:00Z,u1,/api/a,200,100',
      '2025-01-03T11:00:00Z,u2,/api/a,200,101', // avg=100.5 → 101
      '2025-01-03T12:00:00Z,u3,/api/b,200,300',
    ]);
    const out = await aggregate({ filePath: csv, tz: 'jst' });
    expect(out).toContainEqual({ date: '2025-01-03', path: '/api/a', count: 2, avgLatency: 101 });
    expect(out).toContainEqual({ date: '2025-01-03', path: '/api/b', count: 1, avgLatency: 300 });
  });

  it('[TopN] 上位Nは「日付ごと」・count降順・同数はpath昇順', async () => {
    const csv = await writeCsv([
      'timestamp,userId,path,status,latencyMs',
      '2025-01-03T00:00:00Z,u, /a,200,100',
      '2025-01-03T01:00:00Z,u, /a,200,100',
      '2025-01-03T02:00:00Z,u, /b,200,100',
      '2025-01-04T00:00:00Z,u, /c,200,100',
      '2025-01-04T01:00:00Z,u, /d,200,100',
      '2025-01-04T02:00:00Z,u, /d,200,100',
    ].map(s => s.replace(' ', ''))); // quick fix before write
    const out = await aggregate({ filePath: csv, tz: 'jst', top: 1 });
    // 2025-01-03 → /a (count=2) , 2025-01-04 → /d (count=2)
    expect(out).toEqual([
      { date: '2025-01-03', path: '/a', count: 2, avgLatency: 100 },
      { date: '2025-01-04', path: '/d', count: 2, avgLatency: 100 },
    ]);
  });

  it('[Final Sort] date↑ → count↓ → path↑', async () => {
    const csv = await writeCsv([
      'timestamp,userId,path,status,latencyMs',
      '2025-01-02T00:00:00Z,u1,/b,200,100', // date 1/2
      '2025-01-02T01:00:00Z,u2,/a,200,100', // same date, same count=1 → path ASC
      '2025-01-01T00:00:00Z,u3,/z,200,100', // date 1/1 comes first
      '2025-01-02T02:00:00Z,u4,/b,200,100', // makes /b count=2 -> before /a
    ]);
    const out = await aggregate({ filePath: csv, tz: 'jst' });
    expect(out.map(r => `${r.date}:${r.path}:${r.count}`)).toEqual([
      '2025-01-01:/z:1',
      '2025-01-02:/b:2',
      '2025-01-02:/a:1',
    ]);
  });
});
/* eslint-enable max-lines-per-function */
