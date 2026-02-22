import { config } from '@smartwhale/eslint-config/nest'

export default [
  ...config,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
]
