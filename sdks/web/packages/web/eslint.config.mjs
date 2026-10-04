import js from '@eslint/js'
import ts from 'typescript-eslint'
import prettier from 'eslint-config-prettier/flat'

export default ts.config(
  { ignores: ['dist/**', 'src/generated/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
  { files: ['**/*.cjs'], languageOptions: { globals: { module: 'readonly' } } },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'error'
    }
  }
)
