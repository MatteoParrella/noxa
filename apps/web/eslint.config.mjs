import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const configurazione = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    ignores: [
      '.next/',
      'out/',
      'android/',
      'ios/',
      'public/vendor/',
      'next-env.d.ts',
      'playwright-report/',
      'playwright-report-integrazione/',
      'test-results/',
      'src/lib/database.types.ts',
    ],
  },
];

export default configurazione;
