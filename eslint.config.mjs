import { config as base } from '@smartwhale/eslint-config'

export default [
  ...base,
  {
    ignores: ['apps/**', 'packages/**', 'node_modules/**'],
  },
]
