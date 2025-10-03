/* eslint-disable max-lines-per-function */
import { describe, expect, it } from 'vitest';
import { solve } from './solve.js';

describe('Q1 solve', () => {
  it('test run check: returns string', () => {
    expect(typeof solve('')).toBe('string');
  });
  // ------------------------------
  // [C1] ハッピーパス（基本価格の確認）
  // ------------------------------
  it.skip('[C1] Adult/Young/Child の価格が正しく出る', () => {
    const a = solve('Adult,G,10:00,1:00,A-1');
    const y = solve('Young,G,10:00,1:00,A-2');
    const c = solve('Child,G,10:00,1:00,I-3');
    expect(a).toBe('1800円');
    expect(y).toBe('1200円');
    expect(c).toBe('800円');
  });

  it.skip('[C1] 全部OKの複数枚購入で価格が行ごとに出る', () => {
    const input = [
      'Adult,G,10:00,1:00,A-1',
      'Young,G,10:00,1:00,A-2',
      'Child,G,10:00,1:00,I-3',
    ].join('\n');
    const out = solve(input);
    expect(out).toBe(['1800円', '1200円', '800円'].join('\n'));
  });

  // ------------------------------
  // [C2] レーティング規則（年齢制限）
  // ------------------------------
  it('[C2] R18+ を Young/Child で購入不可 → 年齢制限', () => {
    const y = solve('Young,R18+,10:00,1:00,A-1');
    const c = solve('Child,R18+,10:00,1:00,I-2');
    expect(y).toBe('対象の映画は年齢制限により閲覧できません');
    expect(c).toBe('対象の映画は年齢制限により閲覧できません');
  });

  it('[C2] PG-12 を Child 単独で購入不可（Adult 同時購入なし）', () => {
    const out = solve('Child,PG-12,10:00,1:00,I-1');
    expect(out).toBe('対象の映画は年齢制限により閲覧できません');
  });

  it('[C2] PG-12 を Adult + Child 同時購入 → 両方購入可', () => {
    const input = [
      'Adult,PG-12,10:00,1:00,A-1',
      'Child,PG-12,10:00,1:00,I-2',
    ].join('\n');
    const out = solve(input);
    expect(out).toBe(['1800円', '800円'].join('\n'));
  });

  // ------------------------------
  // [C3] 座席規則（J〜L × Child）
  // ------------------------------
  it('[C3] Child の I 行は購入可 / J 行は購入不可 / L 行は購入不可', () => {
    const ok = solve('Child,G,10:00,1:00,I-1');
    const j = solve('Child,G,10:00,1:00,J-1');
    const l = solve('Child,G,10:00,1:00,L-24');
    expect(ok).toBe('800円');
    expect(j).toBe('対象のチケットではその座席をご利用いただけません');
    expect(l).toBe('対象のチケットではその座席をご利用いただけません');
  });

  // ------------------------------
  // [C4] 時刻規則（境界含む、Adult なし）
  // ------------------------------
  it('[C4] Child: 終了16:00ちょうどは可 / 16:01は同伴必要', () => {
    const ok = solve('Child,G,15:00,1:00,I-1'); // end=16:00
    const ng = solve('Child,G,15:01,1:00,I-2'); // end=16:01
    expect(ok).toBe('800円');
    expect(ng).toBe('対象の映画の入場には大人の同伴が必要です');
  });

  it('[C4] Young: 終了18:00ちょうどは可 / 18:01は同伴必要', () => {
    const ok = solve('Young,G,17:00,1:00,A-1'); // end=18:00
    const ng = solve('Young,G,17:01,1:00,A-2'); // end=18:01
    expect(ok).toBe('1200円');
    expect(ng).toBe('対象の映画の入場には大人の同伴が必要です');
  });

  // ------------------------------
  // [C5] グループ規則（Adult 不在で Child を含む）
  // ------------------------------
  it('[C5] Adult なし + Young & Child / 終了16:01超 → 両方 同伴必要 で全体不可', () => {
    const input = [
      'Young,G,15:30,1:00,A-1', // end=16:30
      'Child,G,15:30,1:00,I-2', // end=16:30
    ].join('\n');
    const out = solve(input);
    // 全体不可のときは NG 行だけを出力（価格は出さない）
    expect(out).toBe(
      [
        '対象の映画の入場には大人の同伴が必要です',
        '対象の映画の入場には大人の同伴が必要です',
      ].join('\n')
    );
  });

  it('[C5] Adult を1枚追加で Young/Child とも購入可（同伴必要が消える）', () => {
    const input = [
      'Adult,G,15:30,1:00,A-3',
      'Young,G,15:30,1:00,A-1',
      'Child,G,15:30,1:00,I-2',
    ].join('\n');
    const out = solve(input);
    expect(out).toBe(['1800円', '1200円', '800円'].join('\n'));
  });

  // ------------------------------
  // [C6] 複合理由・順序・重複排除
  // ------------------------------
  it('[C6] Child + PG-12 + J席 + Adultなし + 終了16:01 → 理由3つ（順序固定）', () => {
    const out = solve('Child,PG-12,15:30,1:00,J-10'); // end=16:30
    // 順序：同伴必要 → 年齢制限 → 座席制限
    expect(out).toBe(
      [
        '対象の映画の入場には大人の同伴が必要です',
        '対象の映画は年齢制限により閲覧できません',
        '対象のチケットではその座席をご利用いただけません',
      ].join(',')
    );
  });

  it('[C6] PG-12 Child 単独（安全席・早い時刻）→ 年齢制限のみ', () => {
    const out = solve('Child,PG-12,10:00,1:00,I-1');
    expect(out).toBe('対象の映画は年齢制限により閲覧できません');
  });

  // ------------------------------
  // [C7] 全体不可の出力仕様（価格を出さない）
  // ------------------------------
  it('[C7] 1枚OK/1枚NG の混在 → NG行の理由だけを出力', () => {
    const input = [
      'Adult,G,10:00,1:00,A-1', // OK
      'Child,G,10:00,1:00,J-16', // 座席NG
    ].join('\n');
    const out = solve(input);
    expect(out).toBe('対象のチケットではその座席をご利用いただけません');
  });

  it('[C7] 全部NGなら全NG理由行が並ぶ（入力順）', () => {
    const input = [
      'Child,R18+,10:00,1:00,J-1', // 年齢 + 座席
      'Young,R18+,10:00,1:00,A-2', // 年齢
    ].join('\n');
    const out = solve(input);
    expect(out).toBe(
      [
        // このケースは同伴条件に該当しないので「年齢制限,座席制限」のみ
        '対象の映画は年齢制限により閲覧できません,対象のチケットではその座席をご利用いただけません',
        '対象の映画は年齢制限により閲覧できません',
      ].join('\n')
    );
  });

  // ------------------------------
  // [C8] 不正入力（フォーマット・範囲外）
  // ------------------------------
  it.skip('[C8] 未知の区分/レーティング/座席形式/カラム数不正 → 不正な入力です', () => {
    const cases = [
      'Senior,G,10:00,1:00,A-1', // 未知の年齢
      'Adult,PG12,10:00,1:00,A-1', // 未知のレーティング
      'Adult,G,25:00,1:00,A-1', // 開始時刻範囲外
      'Adult,G,10:00,1:60,A-1', // 上映時間分が60
      'Adult,G,10:00,1:00,M-1', // 行が範囲外
      'Adult,G,10:00,1:00,A-0', // 列0
      'Adult,G,10:00,1:00,A-25', // 列>24
      'Adult,G,10:00,1:00', // カラム不足
    ];
    for (const bad of cases) {
      expect(solve(bad)).toBe('不正な入力です');
    }
  });
});
