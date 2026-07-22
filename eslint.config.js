// Flat config (ESLint 9). This file is ESM because package.json sets
// "type": "module", so the extension stays .js.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores — the flat-config replacement for .eslintignore. Generated
  // and vendored trees only; everything else is linted. public/ is the Vite
  // build output of web/.
  { ignores: ['dist/', 'coverage/', 'drizzle/', 'node_modules/', 'public/'] },

  // Base JS rules + type-aware TS rules across the project. strictTypeChecked
  // is recommendedTypeChecked (floating/misused promises, unsafe `any` flow)
  // plus the stricter correctness rules — unnecessary conditions, confusing
  // void expressions, unsound type assertions. The codebase is small enough
  // that the strict set stays low-noise.
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,

  // Point the type-checked rules at the nearest tsconfig via the project service
  // (no hand-maintained `project` globs). tsconfig.json already includes src, test
  // and *.config.ts, so those are all covered.
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // One relaxation of the strict set: interpolating numbers into template
  // literals is idiomatic and safe (unlike objects/arrays, they stringify
  // predictably), so keep the recommended-set behaviour for them.
  {
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  // This config file is plain JS and deliberately outside the TS project, so turn
  // off the rules that need type information for *.js.
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // React frontend (web/) — the hooks rules catch the classic dependency and
  // conditional-hook mistakes that type-checking alone can't.
  {
    files: ['web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },

  // Must be LAST: drop every rule that would fight Prettier's formatting.
  prettier,
);
