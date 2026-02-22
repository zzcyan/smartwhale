import { config as base } from './index.mjs'

/** @type {import('eslint').Linter.Config[]} */
export const config = [
  ...base,
  {
    rules: {
      // Next.js-specific relaxations
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]
