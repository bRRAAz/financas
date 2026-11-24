import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  { ...js.configs.recommended, files: ['src/**/*.{ts,tsx}'] },
  ...tseslint.configs.recommended,
]
