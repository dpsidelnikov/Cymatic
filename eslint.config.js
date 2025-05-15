// eslint.config.js
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        document: 'readonly',
        alert: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'spaced-comment': [
        'warn',
        'always',
        {
          line: {
            markers: ['/'], // allow `///` for TS triple-slash
            exceptions: ['-'], // allow `//----` for sectioning
          },
          block: {
            balanced: true,
          },
        },
      ],
    },
  },
  eslintConfigPrettier,
];
