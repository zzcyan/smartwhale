import { config as base } from './index.mjs'

/** @type {import('eslint').Linter.Config[]} */
export const config = [
  ...base,
  {
    rules: {
      // NestJS uses classes/decorators heavily — these are expected patterns
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
]
