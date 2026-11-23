import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),

  // tailwind.config.js is the one CommonJS file here (module.exports +
  // require). The other *.config.js files are ESM, so this override is scoped
  // to it alone — a broader glob makes ESLint fail to parse them.
  {
    files: ['tailwind.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-undef': 'error',
    },
  },

  {
    files: ['**/*.{js,jsx}'],
    ignores: ['tailwind.config.js'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // Without this, no-unused-vars does not count a name referenced only
      // inside JSX, so `import { motion }` used solely as <motion.div> was
      // reported as unused across 12 files. Acting on those reports would have
      // deleted imports the app depends on and broken every animation.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',

      'no-unused-vars': [
        'error',
        {
          // PascalCase and SCREAMING_CASE names are often re-exported or used
          // only as JSX; jsx-uses-vars covers the JSX case, this covers the rest.
          varsIgnorePattern: '^[A-Z_]',
          // Unused function arguments are frequently required by a signature
          // (Express error handlers need four). Flag them only when prefixed
          // with nothing meaningful.
          args: 'after-used',
          argsIgnorePattern: '^_',
          // Destructuring-to-omit — `const { id, ...rest } = obj` — is a
          // deliberate pattern, not dead code.
          ignoreRestSiblings: true,
        },
      ],
    },
  },
])
