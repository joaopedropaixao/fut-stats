import base from '@fut-stats/eslint-config/base';

export default [
  ...base,
  {
    files: ['jest.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
