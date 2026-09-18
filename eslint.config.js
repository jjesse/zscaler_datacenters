'use strict';

const js = require('@eslint/js');

const sharedRules = {
  'no-console': 'off',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'prefer-const': 'error',
  eqeqeq: ['error', 'always'],
  semi: ['error', 'always'],
  quotes: ['error', 'single', { avoidEscape: true }],
};

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    ignores: ['public/**', 'node_modules/**'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    rules: sharedRules,
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        alert: 'readonly',
        Blob: 'readonly',
        console: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        html2canvas: 'readonly',
        L: 'readonly',
        module: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        window: 'readonly',
      },
    },
    rules: sharedRules,
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        document: 'readonly',
        HTMLElement: 'readonly',
        window: 'readonly',
      },
    },
  },
];
