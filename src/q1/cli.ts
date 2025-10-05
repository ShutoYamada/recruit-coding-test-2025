import { stdin, stdout } from 'node:process';
import { solve } from './solve.js';

// 標準入力からデータを読み取る
const readStdin = async (): Promise<string> => {
  if (stdin.isTTY) {
    // 端末実行時はヘルプメッセージを表示
    stdout.write('Paste input then Ctrl+D (Unix) / Ctrl+Z Enter (Win)\n');
  }
  return await new Promise((resolve) => {
    let data = '';
    stdin.setEncoding('utf-8');
    stdin.on('data', (chunk) => (data += chunk));
    stdin.on('end', () => resolve(data));
  });
};

// メイン処理
const main = async () => {
  const input = await readStdin();
  const output = solve(input);
  stdout.write(output + (output.endsWith('\n') ? '' : '\n'));
};

// 例外処理
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
