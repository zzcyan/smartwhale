import { config } from '@smartwhale/eslint-config/next'

export default [
  ...config,
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
]
