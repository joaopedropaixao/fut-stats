import base from '@fut-stats/eslint-config/base';

export default [
  // Client gerado pelo Prisma (`pnpm generate`)
  { ignores: ['src/generated/**'] },
  ...base,
  {
    files: ['jest.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
