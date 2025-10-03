import { createReadStream } from 'node:fs';
import { argv, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { aggregate } from './core.js';

const parseArgs = (): Record<string, string> => {
  const args: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
};

const main = async () => {
  const args = parseArgs();
  const file = args['file'];
  if (!file) throw new Error('--file is required');
  const from = args['from'] || '1970-01-01';
  const to = args['to'] || '2100-12-31';
  const tzArg = (args['tz'] || 'jst').toLowerCase();
  if (tzArg !== 'jst' && tzArg !== 'ict') {
    throw new Error("--tz must be 'jst' or 'ict'");
  }
  const tz: 'jst' | 'ict' = tzArg as 'jst' | 'ict';
  let top = parseInt(args['top'] || '5', 10);
  if (!Number.isFinite(top) || top <= 0) {
    top = 5; // フォールバック
  }

  // 逐次読み込み
  const rl = createInterface({
    input: createReadStream(file, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  const rows: string[] = [];
  for await (const line of rl) {
    if (!line || /^\s*$/.test(line)) continue;
    rows.push(line);
  }

  const result = aggregate(rows, { from, to, tz, top });
  stdout.write(JSON.stringify(result) + '\n');
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
