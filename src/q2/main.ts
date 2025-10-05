// Node.js標準ライブラリとコアロジックのインポート
import { createReadStream } from 'node:fs';
import { argv, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { aggregate } from './core.js';

// コマンドライン引数をパースしてオブジェクト形式に変換
const parseArgs = (): Record<string, string> => {
  const args: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2]; // --key=value形式をパース
  }
  return args;
};

// メイン処理：CLI引数を解析し、CSVファイルを読み込んで集計し、JSONで出力
const main = async () => {
  const args = parseArgs();
  
  // 必須パラメータのチェック
  const file = args['file'];
  if (!file) throw new Error('--file is required');
  
  // オプションパラメータのデフォルト値設定
  const from = args['from'] || '1970-01-01';
  const to = args['to'] || '2100-12-31';
  const tz = (args['tz'] || 'jst').toLowerCase();
  const top = parseInt(args['top'] || '5', 10);

  // CSVファイルを行ごとに読み込み
  const rl = createInterface({
    input: createReadStream(file, { encoding: 'utf-8' }),
    crlfDelay: Infinity, // CRLFを適切に処理
  });

  const rows: string[] = [];
  for await (const line of rl) {
    if (!line || /^\s*$/.test(line)) continue; // 空行をスキップ
    rows.push(line);
  }

  // 集計処理を実行してJSONで出力
  const result = aggregate(rows, { from, to, tz: tz as never, top });
  stdout.write(JSON.stringify(result) + '\n');
};

// エラーハンドリング：例外が発生した場合はエラーメッセージを表示して終了
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
