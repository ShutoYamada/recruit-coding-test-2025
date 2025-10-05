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
  const tz = (args['tz'] || 'jst').toLowerCase();
  const top = parseInt(args['top'] || '5', 10);

  // 逐次読み込み
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error('--from/--to must be YYYY-MM-DD');
  }
  if (tz !== 'jst' && tz !== 'ict') {
    throw new Error('--tz must be jst or ict');
  }
  if (!Number.isFinite(top) || top <= 0) {
    throw new Error('--top must be > 0');
  }
  const rl = createInterface({
    input: createReadStream(file, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  const lines: string[] = [];
  for await (const line of rl) {
    if (!line || /^\s*$/.test(line)) continue;
    if (lines.length === 0 &&
      /^timestamp,userId,path,status,latencyMs\s*$/i.test(line.trim())
    ) {
      continue;
    }
    lines.push(line);
  }


  const result = aggregate(lines, { from, to, tz: tz as 'jst' | 'ict', top });
  stdout.write(JSON.stringify(result) + '\n');
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
