import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'dist/',
      'coverage/',
      'reports/',
      'docs/',
      'icm/',
      'graphify-out/',
      '.impeccable/',
      'reference/', // frozen front-end snapshot, generated
      'src/web/', // never linted yet; remove once it passes ESLint
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['src/client/**', 'src/mock-aide/**'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['src/client/public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  prettier,
];
