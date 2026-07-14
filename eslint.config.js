import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Netlify edge functions run on Deno, not in the browser: `Netlify.env` is the
    // runtime's own global, and there is no React here.
    files: ['netlify/edge-functions/**/*.js'],
    languageOptions: {
      globals: { ...globals.deno, Netlify: 'readonly' },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Build-time scripts run on Node.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
