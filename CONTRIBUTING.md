# Contributing to Crudora

Thanks for taking the time to contribute! This document covers everything you need to get started.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Commit Conventions](#commit-conventions)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

Be respectful. Constructive feedback is welcome; personal attacks are not. If you're unsure whether something is appropriate, err on the side of kindness.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
git clone https://github.com/suryamsj/crudora.git
cd crudora
npm install
```

Verify everything works:

```bash
npm test
```

---

## Project Structure

```
src/
├── core/
│   ├── crudora.ts          # Route generator + business logic
│   ├── crudoraServer.ts    # Express server wrapper
│   ├── drizzleTableBuilder.ts  # Builds Drizzle table objects from @Field metadata
│   ├── model.ts            # Base Model class (tableName, timestamps, softDelete, etc.)
│   ├── repository.ts       # CRUD operations via Drizzle ORM
│   └── schemaGenerator.ts  # Generates Drizzle schema .ts files for drizzle-kit
├── decorators/
│   └── model.ts            # @Field, @Model, @HasMany, @BelongsTo, etc.
├── types/
│   └── model.type.ts       # FieldOptions, Dialect, FieldType, etc.
├── utils/
│   └── validation.ts       # Zod schema generation from @Field metadata
├── cli.ts                  # crudora CLI entry point
└── index.ts                # Public exports

tests/
├── core/                   # Unit tests per core module
├── decorators/             # Decorator unit tests
├── integration/            # End-to-end CRUD operation tests
└── utils/                  # Utility unit tests
```

---

## Development Workflow

### Build

```bash
npm run build
```

Produces dual ESM/CJS output in `dist/` via [tsup](https://tsup.egoist.dev).

### Watch mode (type checking only)

```bash
npm run build:watch
```

### Lint & Format

```bash
npm run lint
npm run format
```

---

## Testing

Crudora uses [Jest](https://jestjs.io) with [ts-jest](https://kulshekhar.github.io/ts-jest/).

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage
```

### Writing Tests

- Tests live in `tests/` mirroring the `src/` structure.
- Database calls are mocked via the shared `SelectChain` helper in `tests/setup.ts` — no real DB is needed.
- Every new feature or bug fix should include a test.
- Aim to keep **statement coverage above 90%** and **line coverage above 95%** for any file you touch.
- Do not add tests that only cover defensive/unreachable branches just to inflate numbers.

### Test Setup

`tests/setup.ts` exports a `dbMock` object and chain helpers that simulate Drizzle's query builder. Import them in your test:

```typescript
import { dbMock, SelectChain, insertValuesMock } from '../setup';
```

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `test:` | Adding or updating tests |
| `refactor:` | Code change that is neither a fix nor a feature |
| `docs:` | Documentation only |
| `chore:` | Build process, dependencies, tooling |
| `perf:` | Performance improvement |

Examples:

```
feat: add includeHidden option to repository find methods
fix: correctly handle nullable+required field combination in Zod schema
test: add MySQL soft-delete coverage for DrizzleTableBuilder
docs: add authentication guide
```

---

## Submitting a Pull Request

1. Fork the repo and create your branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes following the guidelines above.

3. Ensure all tests pass:
   ```bash
   npm test
   ```

4. Ensure the build succeeds:
   ```bash
   npm run build
   ```

5. Open a PR against `main` with a clear description of:
   - What the change does
   - Why it's needed
   - How to test it

6. A maintainer will review your PR. Feedback may be requested before merging.

### PR Checklist

- [ ] Tests added/updated
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] No new TypeScript errors
- [ ] CHANGELOG updated if this is a user-facing change

---

## Reporting Bugs

Open an issue at [github.com/suryamsj/crudora/issues](https://github.com/suryamsj/crudora/issues) and include:

- Crudora version (`npm ls crudora`)
- Node.js version (`node -v`)
- Minimal reproduction (a few lines of code that trigger the bug)
- Expected vs actual behavior

---

## Requesting Features

Open an issue with the `enhancement` label. Describe:

- The problem you're trying to solve
- Your proposed solution (if any)
- Alternatives you've considered

Feature requests with a clear use case and a willingness to contribute a PR are prioritized.

---

## Adding a New Field Type

If you want to add a new `FieldType` (e.g., `'point'` for PostGIS):

1. Add the type to `src/types/model.type.ts` → `FieldType` union.
2. Handle it in `src/core/drizzleTableBuilder.ts` → `buildPgColumn` / `buildMysqlColumn`.
3. Handle it in `src/core/schemaGenerator.ts` → `pgColumnDef` / `mysqlColumnDef` + `getColumnImport`.
4. Handle it in `src/utils/validation.ts` → `zodTypeFor` switch.
5. Add tests in `tests/core/drizzleTableBuilder.test.ts` and `tests/core/schemaGenerator.test.ts`.

---

## Questions?

Open a [GitHub Discussion](https://github.com/suryamsj/crudora/discussions) or file an issue tagged `question`.
