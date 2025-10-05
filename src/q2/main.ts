// ==============================
// Q2 CLI: 引数パース → aggregate → JSON 出力
// ------------------------------
// 依存ライブラリなしで --file/--from/--to/--tz/--top を簡易パース。

import { aggregate, Options, Tz } from './core.js';

function parseArgs(argv: string[]): Options {
  const out: Partial<Options> = {};

  // 次の引数の値を安全に取得
  const getVal = (i: number) => {
    const s = argv[i];
    if (!s || s.startsWith('--')) throw new Error('値が必要です');
    return s;
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--file=')) out.filePath = a.slice(7);
    else if (a === '--file') out.filePath = getVal(++i);
    else if (a.startsWith('--from=')) out.from = a.slice(7);
    else if (a === '--from') out.from = getVal(++i);
    else if (a.startsWith('--to=')) out.to = a.slice(5);
    else if (a === '--to') out.to = getVal(++i);
    else if (a.startsWith('--tz=')) out.tz = a.slice(5) as Tz;
    else if (a === '--tz') out.tz = getVal(++i) as Tz;
    else if (a.startsWith('--top=')) out.top = Number(a.slice(6));
    else if (a === '--top') out.top = Number(getVal(++i));
  }

  // 必須・妥当性チェック
  if (!out.filePath) throw new Error('`--file` は必須です');
  if (!out.tz || (out.tz !== 'jst' && out.tz !== 'ict')) {
    throw new Error('`--tz` は jst|ict のみ');
  }
  if (out.top !== undefined && (!Number.isFinite(out.top) || out.top! <= 0)) {
    throw new Error('`--top` は正の数');
  }

  return out as Options;
}

async function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = await aggregate(opts);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (e: unknown) {
    // any を使わず unknown で受けて安全にメッセージを出す
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    process.exitCode = 1;
  }
}

// 直接実行時のみ起動
void main();
// ==============================
