import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  // 無視パターン
  {
    ignores: ['dist', 'node_modules', 'coverage', '.devcontainer', '.github'],
  },

  // TypeScript 用設定
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // tsconfig を使った型情報まで欲しければ以下を有効化
        // project: ['./tsconfig.json'],
        // tsconfigRootDir: process.cwd(),
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    // 推奨ルール + ちょい品質ルール
    rules: {
      // @typescript-eslint 推奨
      ...tsPlugin.configs.recommended.rules,
      complexity: ['warn', { max: 16 }],
      'max-lines-per-function': [
        'warn',
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
      'no-unused-vars': 0,
    },
  },

  // Test files: allow longer functions (many assertions per case)
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
];
