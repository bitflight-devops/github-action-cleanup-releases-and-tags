# GitHub Action Cleanup Releases and Tags - Copilot Instructions

## Repository Summary

This is a **GitHub Action** that removes releases and tags based on pattern matching. It is primarily used to clean up unused tags and releases created during the PR process. The action is written in TypeScript and compiled to a single CommonJS bundle for Node.js 20 runtime.

**Project Type**: GitHub Action  
**Language**: TypeScript (Node.js >=20.0.0, runtime: Node.js 20)  
**Package Manager**: Yarn 3.3.0 (Berry)  
**Build Tool**: esbuild (targeting node20)  
**Test Framework**: Jest 30 with ts-jest  
**Size**: Small (~87 lines of source code in 2 TypeScript files)

## Build and Validation Instructions

### Initial Setup

**ALWAYS run `yarn install` first before any other commands.** This repository uses Yarn 3.3.0 with Plug'n'Play:

```bash
yarn install
```

**Expected**: Takes ~60-90 seconds. Peer dependency warnings are normal and safe to ignore.

### Build Process

**Build the action (required before committing):**

```bash
yarn build
```

**Expected**: Completes in ~300ms. Creates `dist/index.cjs` (7MB) and `dist/index.cjs.map` (10.5MB).  
**Note**: The `dist/` directory MUST be committed - this is a GitHub Action and requires the bundled output.

### Testing

**Run tests:**

```bash
yarn test
```

**Expected**: Completes in ~0.5 seconds. 1 test suite, 1 passing test.  
**Note**: Tests use Jest 30 with NODE_ENV=testing.

### Linting and Formatting

**Format code:**

```bash
yarn format:all
```

**Expected**: Formats all files using Prettier. Safe to run anytime.

**Lint code:**

```bash
yarn lint
```

**Expected**: Completes successfully with no errors. ESLint 8.57 with TypeScript 5.9.3.  
**Note**: All deprecated rules have been removed or updated. The project uses ESLint 8 for compatibility with all plugins.

**Type check:**

```bash
yarn typecheck
```

**Expected**: Completes with no errors or warnings. TypeScript 5.9.3 with @tsconfig/node20 and @tsconfig/strictest.

### Pre-commit Hooks

This repository uses Husky for pre-commit hooks (`.husky/pre-commit`):

```bash
yarn test && yarn build && git add dist
npx lint-staged
```

**Critical**: The pre-commit hook:

1. Runs tests - must pass
2. Builds the action - must succeed
3. **Automatically stages the `dist/` directory** - this is required
4. Runs lint-staged on changed files

**If pre-commit fails**: Fix the tests or build errors. Do NOT skip the hook or disable it.

## Project Layout

### File Structure

```
/
├── src/                      # Source code (TypeScript)
│   ├── index.ts             # Main action entry point (75 lines)
│   └── index.spec.ts        # Tests (12 lines)
├── dist/                     # Build output (MUST be committed)
│   ├── index.cjs            # Bundled action (7MB)
│   └── index.cjs.map        # Source map (10.5MB)
├── .github/
│   ├── workflows/
│   │   └── cleanup_tags_and_releases.yml  # Self-test workflow
│   └── dependabot.yml       # Dependency updates (daily)
├── action.yml               # GitHub Action metadata
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript config (extends tsconfig.base.json)
├── tsconfig.base.json       # Base TS config (extends @tsconfig/node20 + @tsconfig/strictest)
├── jest.config.js           # Jest configuration (ts-jest preset)
├── .eslintrc.json           # ESLint rules (extensive TypeScript rules)
├── .prettierrc.cjs          # Prettier formatting rules
├── lint-staged.config.js    # Lint-staged configuration
└── .husky/pre-commit        # Pre-commit hook script
```

### Key Configuration Files

- **action.yml**: Defines action inputs (pr_number, branch, repository, regex, github_token) and runs using Node.js 20 with `dist/index.cjs`
- **tsconfig.json**: Extends `@tsconfig/node20` and `@tsconfig/strictest`, targets Node 20+, outputs to `lib/` (unused, esbuild outputs to `dist/`)
- **package.json**: Main entry is `dist/index.cjs`, engines require Node >=20.0.0, uses TypeScript 5.9.3
- **.eslintrc.json**: ESLint 8.57 config with TypeScript 8.52, Jest, Airbnb, SonarJS, and Unicorn plugins
- **.prettierrc.cjs**: 2-space indent, single quotes, semicolons, 120 char width for TypeScript

### Source Code Overview

**src/index.ts**: Main action logic

- Imports from `@broadshield/github-actions-core-typed-inputs` and `@broadshield/github-actions-workflow-marie-kondo`
- Parses inputs: pr_number, branch, repository, regex, github_token
- Creates search regex pattern (default: `^(.*)?${searcher}(.*)?$`)
- Uses `Kondo` class to filter and delete matching releases and tags
- Sets outputs: `matched_releases`, `matched_tags`

**src/index.spec.ts**: Single test for `getGithubToken` function

### Dependencies

**Runtime Dependencies** (4 packages):

- `@broadshield/github-actions-core-typed-inputs`: Core GitHub Actions utilities
- `@broadshield/github-actions-octokit-hydrated`: Octokit wrapper
- `@broadshield/github-actions-workflow-marie-kondo`: Release/tag cleanup utility
- `tslib`: TypeScript runtime helpers (2.8.1)

**Dev Dependencies**: All updated to Jan 2026 versions - TypeScript 5.9.3, ESLint 8.57, @typescript-eslint 8.52, Jest 30, esbuild 0.27, and more

## CI/CD and Validation

### GitHub Workflows

**cleanup_tags_and_releases.yml**: Self-test workflow

- Triggers: `pull_request[closed]`, `delete`, `workflow_dispatch`
- Checks out repo and runs the action against itself
- Uses `GH_PERSONAL_ACCESS_TOKEN` or `GITHUB_TOKEN`

### Pre-commit Validation

The `.husky/pre-commit` hook ensures:

1. All tests pass (`yarn test`)
2. Build succeeds (`yarn build`)
3. Built artifacts in `dist/` are staged (`git add dist`)
4. Lint-staged runs on modified files:
   - TypeScript/JavaScript files: ESLint fix + Prettier format
   - Markdown/YAML/JSON files: Prettier format

### Manual Validation Steps

After making changes:

1. Run `yarn test` - must pass
2. Run `yarn build` - must succeed
3. Verify `dist/index.cjs` was regenerated (check file size/timestamp)
4. Run `yarn format:all` to format any changed files
5. Commit changes (pre-commit hook will validate)

## Known Issues and Workarounds

### Yarn Peer Dependency Warnings

**Issue**: Warnings about peer dependencies during `yarn install`  
**Impact**: None - packages function correctly despite warnings  
**Workaround**: Safe to ignore. These are expected with the current package versions.

## Important Notes for Coding Agents

1. **ALWAYS run `yarn install` before any build/test commands** if node_modules or .yarn/cache are missing
2. **ALWAYS run `yarn build` after modifying TypeScript files** - the dist/ output is required for the action to work
3. **ALWAYS commit the dist/ directory** - GitHub Actions require the bundled output
4. **Do NOT remove or modify the pre-commit hook** - it ensures dist/ is always up to date
5. **Node version**: The action runs on Node.js 20 (per action.yml). Development requires Node.js >=20.0.0. Use Node.js 20.19.6 or later.
6. **TypeScript**: Uses TypeScript 5.9.3 with @typescript-eslint 8.52 - all deprecated rules have been removed
7. **Format TypeScript with Prettier**: 2 spaces, single quotes, semicolons, trailing commas
8. **Test changes**: Run `yarn test && yarn build` to validate - this is what the pre-commit hook runs
9. **Yarn 3 (Berry)**: This repo uses Yarn 3.3.0 with Plug'n'Play - DO NOT use npm or yarn 1.x commands
10. **Main branch protection**: Changes go through PRs - the cleanup workflow runs on PR close
11. **Deprecated packages replaced**: `eslint-plugin-node` → `eslint-plugin-n` (Jan 2026 updates)

## Quick Reference Commands

```bash
# Full validation sequence (run before committing)
yarn install && yarn test && yarn build

# Format code
yarn format:all

# Individual commands
yarn test          # Run Jest 30 tests (~0.5s)
yarn build         # Build with esbuild (~300ms, targets node20)
yarn typecheck     # TypeScript 5.9 check (no errors/warnings)
yarn lint          # ESLint 8.57 (all deprecated rules removed)
```

**Trust these instructions.** Only search for additional information if these instructions are incomplete or incorrect for your specific task.
