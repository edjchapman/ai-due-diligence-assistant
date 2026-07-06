// Flat config (ESLint 9). This file is ESM because package.json sets
// "type": "module", so the extension stays .js.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores — the flat-config replacement for .eslintignore. Generated
  // and vendored trees only; everything else is linted.
  { ignores: ['dist/', 'coverage/', 'drizzle/', 'node_modules/'] },

  // Base JS rules + type-aware TS rules across the project. recommendedTypeChecked
  // is the high-signal set: it catches floating/misused promises and unsafe `any`
  // flow — exactly the review signal a senior TS codebase should surface.
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,

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

  // This config file is plain JS and deliberately outside the TS project, so turn
  // off the rules that need type information for *.js.
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Must be LAST: drop every rule that would fight Prettier's formatting.
  prettier,
);
