import globals from 'globals'
import js from '@eslint/js'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs}'],
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  js.configs.recommended,
  {
    name: 'app/general-rules',
    rules: {
      'quote-props': ['error', 'as-needed'],
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: false }],
      semi: ['error', 'never'],
    },
  },
  {
    name: 'app/javascript-rules',
    files: ['**/*.{js,mjs,jsx}'],
    rules: {
      'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
    },
  },
]
