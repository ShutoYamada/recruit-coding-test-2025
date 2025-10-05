import fs from 'fs'; // for readFileSync
import { createReadStream } from 'node:fs';
import { argv } from 'node:process';
import { createInterface } from 'node:readline';
import { aggregate } from './core.js';

const parseArgs = (): Record<string, string> => {                           // --key=value
  const args: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
};

const main = async () => {                                                  // main async function
  const args = parseArgs();
  const file = args['file'];
  if (!file) throw new Error('--file is required');                         // required
  const from = args['from'] || '1970-01-01';
  const to = args['to'] || '2100-12-31';
  const tz = (args['tz'] || 'jst').toLowerCase();
  const top = parseInt(args['top'] || '5', 10);

  // 逐次読み込み
  const rl = createInterface({
    input: createReadStream(file, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  const rows: string[] = [];                                                  // collect lines
  for await (const line of rl) {
    if (!line || /^\s*$/.test(line)) continue;
    rows.push(line);
  }

};

main().catch((e) => {                                                         //  catch errors
  console.error(e);
  process.exit(1);
});



const filePath = process.argv.find(arg => arg.startsWith('--file='))?.split('=')[1]; // get --file argument
if (!filePath) {
  console.error('Missing --file argument');
  process.exit(1);
}



const args = process.argv.slice(2);
const options: Record<string, string> = {};                                   // to hold parsed options
for (const arg of args) {
  const [key, value] = arg.split('=');
  if (key && value) {
    options[key.replace(/^--/, '')] = value;
  }
}
// Validate required options
if (!options.file || !options.from || !options.to || !options.tz || !options.top) {
  console.error('Missing required arguments: --file, --from, --to, --tz, --top');
  process.exit(1);
}

// Read file and split into lines
const raw = fs.readFileSync(options.file, 'utf-8');
const lines = raw.trim().split('\n');

// Run aggregation
const result = aggregate(lines, {
  from: options.from,
  to: options.to,
  tz: options.tz as 'jst' | 'ict',
  top: Number(options.top),
});

console.log(JSON.stringify(result, null, 2));

