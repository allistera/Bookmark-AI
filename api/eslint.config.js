import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        crypto: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        D1Database: 'readonly',
        ExecutionContext: 'readonly',
        CryptoKey: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-unused-vars': 'off', // Use TypeScript version instead
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'no-undef': 'off', // TypeScript handles this
    },
  },
  {
    ignores: ['node_modules/', 'dist/', '.wrangler/'],
  },
];
