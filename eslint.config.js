// /home/nneessen/projects/commissionTracker/eslint.config.js

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'build', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain/**' },
        { type: 'application', pattern: 'src/application/**' },
        { type: 'infrastructure', pattern: 'src/infrastructure/**' },
        { type: 'infrastructure', pattern: 'src/services/**' },
        { type: 'hooks', pattern: 'src/hooks/**' },
        { type: 'features', pattern: 'src/features/**' },
        { type: 'ui', pattern: 'src/components/**' },
        { type: 'shared-domain', pattern: 'src/domain/shared/**' },
        { type: 'shared-app', pattern: 'src/application/shared/**' },
        { type: 'shared-infra', pattern: 'src/infrastructure/shared/**' },
        { type: 'shared-infra', pattern: 'src/services/shared/**' },
        { type: 'shared-ui', pattern: 'src/ui/shared/**' },
        { type: 'shared-ui', pattern: 'src/components/shared/**' },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Ban the `new Date().toISOString().split(...)` "today" antipattern: that's the UTC
      // calendar date, which rolls over an evening early in the Americas and empties out
      // daily leaderboards/KPIs/effective-date windows. Use getTodayString() / formatDateForDB()
      // from @/lib/date (LOCAL date) instead.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='split'][callee.object.callee.property.name='toISOString'][callee.object.callee.object.type='NewExpression'][callee.object.callee.object.callee.name='Date'][callee.object.callee.object.arguments.length=0]",
          message:
            "Don't derive a date from `new Date().toISOString().split(...)` — that's the UTC date and is wrong in the evening for the Americas. Use getTodayString() / formatDateForDB() from @/lib/date (local).",
        },
      ],
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'domain', allow: [] },
            { from: 'application', allow: ['domain', 'shared-domain'] },
            {
              from: 'infrastructure',
              allow: ['domain', 'application', 'shared-domain', 'shared-app'],
            },
            {
              from: 'hooks',
              allow: ['application', 'domain', 'shared-domain', 'shared-app'],
            },
            {
              from: 'features',
              allow: [
                'hooks',
                'application',
                'domain',
                'shared-domain',
                'shared-app',
                'shared-ui',
              ],
            },
            {
              from: 'ui',
              allow: ['hooks', 'application', 'domain', 'shared-domain', 'shared-ui'],
            },
          ],
        },
      ],
      'boundaries/no-private': [
        'error',
        {
          allowUncles: false,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'src/domain/*/**',
                'src/application/*/**',
                'src/infrastructure/*/**',
                'src/services/*/**',
                'src/hooks/*/**',
                'src/features/*/**',
                '@/domain/*/**',
                '@/application/*/**',
                '@/infrastructure/*/**',
                '@/services/*/**',
                '@/hooks/*/**',
                '@/features/*/**',
              ],
              message:
                'Deep imports are forbidden. Import only from the feature/domain index.ts barrel.',
            },
          ],
        },
      ],
    },
  },
  // Disable react-refresh warning for shadcn/ui components (they export variants)
  {
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Disable react-refresh warning for context files (they export context + hooks together)
  {
    files: ['src/contexts/**/*.tsx', 'src/**/context/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Disable react-refresh warning for page/route files (they export loaders + components)
  {
    files: ['src/router.tsx', 'src/routes/**/*.tsx', 'src/features/**/pages/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Disable react-refresh warning for feature components that export utilities alongside
  {
    files: [
      'src/features/**/components/**/*.tsx',
      'src/features/**/admin/**/*.tsx',
      'src/features/auth/**/*.tsx',
      'src/features/dashboard/**/*.tsx',
      'src/features/comps/**/*.tsx',
      'src/features/test/**/*.tsx',
      'src/components/shared/**/*.tsx',
      'src/components/permissions/**/*.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Disable no-explicit-any and no-restricted-imports for test files (mocks need full access)
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-imports': 'off',
    },
  },
  // Deno edge functions run server-side (UTC) and can't import @/lib/date — the local-date
  // rule is for the browser app only. Their date handling is a separate (server) concern.
  {
    files: ['supabase/functions/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  // Dev-only tooling under scripts/ (render harnesses, smoke runners) is NOT app code
  // and is excluded from the production build, so it isn't bound by the feature-barrel
  // architecture — it legitimately reaches into feature internals to exercise them.
  {
    files: ['scripts/**/*.{ts,tsx,mjs}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-imports': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  // Exception: Hooks inside features CAN import from services (they're the data layer interface)
  {
    files: ['src/features/**/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Exception: Root-level hooks CAN import from services (they ARE the data access layer)
  {
    files: ['src/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Exception: Service files CAN import from other services and base utilities (infrastructure layer)
  {
    files: ['src/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Exception: Feature-internal service files CAN import from base services
  {
    files: ['src/features/**/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Exception: RuleEngine components are tightly coupled to the DSL (pure type/parsing library)
  {
    files: ['src/features/underwriting/components/RuleEngine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Exception: Interactive checklist item components use checklistResponseService directly
  {
    files: ['src/features/recruiting/components/interactive/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    ignores: ['src/features/**/hooks/**/*.{ts,tsx}', 'src/features/**/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'src/infrastructure',
              message:
                'UI/features must not import infrastructure directly. Use hooks or application services.',
            },
            {
              name: 'src/services',
              message:
                'UI/features must not import infrastructure directly. Use hooks or application services.',
            },
            {
              name: '@/services',
              message:
                'UI/features must not import infrastructure directly. Use hooks or application services.',
            },
            {
              name: 'supabase',
              message: 'Supabase client must not be imported in UI/features.',
            },
            {
              name: '@/services/base/supabase',
              message: 'Supabase client must not be imported in UI/features.',
            },
            {
              name: 'src/services/base/supabase',
              message: 'Supabase client must not be imported in UI/features.',
            },
          ],
          patterns: [
            {
              group: [
                'src/infrastructure/**',
                'src/services/**',
                '@/services/**',
                'supabase/**',
                '@/services/base/supabase',
                'src/services/base/supabase',
              ],
              message: 'UI/features must not import infrastructure or Supabase directly.',
            },
            {
              group: [
                'src/domain/*/**',
                'src/application/*/**',
                'src/infrastructure/*/**',
                'src/services/*/**',
                'src/hooks/*/**',
                'src/features/*/**',
                '@/domain/*/**',
                '@/application/*/**',
                '@/infrastructure/*/**',
                '@/services/*/**',
                '@/hooks/*/**',
                '@/features/*/**',
              ],
              message:
                'Deep imports are forbidden. Import only from the feature/domain index.ts barrel.',
            },
          ],
        },
      ],
    },
  },
  // Exception: Layout components may import from @/services/email barrel (the unified send gateway).
  // Placed after the broad components rule so it takes precedence (ESLint flat config: last wins).
  // Still blocks deep paths like @/services/email/**, only allows the barrel itself.
  {
    files: ['src/components/layout/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/services/email/**', 'src/services/email/**'],
              message: 'Import from @/services/email (the barrel), not from a deep path within it.',
            },
          ],
        },
      ],
    },
  },
);
