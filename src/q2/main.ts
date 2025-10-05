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
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
  if (!dateRegex.test(from)) throw new Error('--from is invalid');
  if (!dateRegex.test(args['to'] || '')) throw new Error('--to is invalid');
  const tz = (args['tz'] || 'jst').toLowerCase();
  if (tz !== 'ict' && tz !== 'jst') throw new Error('--tz is invalid'); // ICT or JST
  const top = parseInt(args['top'] || '5', 10);
  if (isNaN(top) || top <= 0) throw new Error('--top is invalid'); // positive integer

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

  const result = aggregate(rows, { from, to, tz: tz as never, top });
  stdout.write(JSON.stringify(result) + '\n');
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
