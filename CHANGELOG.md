# Changelog

All notable changes to Crudora are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [Semantic Versioning](https://semver.org/).

---

## [0.2.0] — 2026-05-17

### Added
- **Drizzle ORM** as the primary ORM (replaces Prisma) — zero schema.prisma, no global install required
- **Multiple schema support** — `static schema` on a Model maps to `pgSchema()` / `mysqlSchema()`
- **`DrizzleTableBuilder`** — builds Drizzle table objects at runtime from `@Field()` metadata
- **`registerTable(ModelClass, drizzleTable)`** — plug in a pre-built table (e.g. from `drizzle-kit introspect`) without redefining columns
- **Rich field types** — `uuid`, `string`, `text`, `integer`, `number`, `boolean`, `date`, `decimal`, `json`, `enum`, `bigint`, `serial`, `array`
- **Advanced query filters** — `_gt`, `_gte`, `_lt`, `_lte`, `_ne`, `_like`, `_in` operators on any column via query params
- **Cursor pagination** — `findWithCursor()` with composite tie-breaking for non-unique cursor fields
- **Soft delete** — `static softDelete = true` adds `deletedAt`; `restore()` and `hardDelete()` on Repository
- **Relations** — `@HasMany`, `@HasOne`, `@BelongsTo`, `@BelongsToMany` with batch `_in` loading; `?with=relation` query param
- **`createMany()`** — bulk insert with batching (500 rows/batch), `afterCreateMany` hook
- **`findOne()`, `exists()`, `count()`** — direct Repository methods
- **Transactions** — `repository.transaction(fn)` wraps all relation loads in the same connection
- **Cursor-based pagination** — `?cursor=base64` query param; composite condition for non-unique cursor fields
- **`select` and `with` query params** — field projection and eager relation loading per request
- **`sortBy` / multiple `orderBy`** — `?orderBy=createdAt,name&order=desc,asc`
- **Rate limiting** — built-in sliding-window in-memory rate limiter with `X-RateLimit-*` headers; configurable or disableable
- **Body-size limit** — `bodyParserLimit` config option (default `'100kb'`), returns 413 on oversize
- **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 0` on every response
- **Structured logging** — built-in JSON logger with correlation IDs; accepts any pino/winston-compatible logger or `false`
- **CORS** — `cors: true | false | string | string[]` configuration
- **`generateDrizzleSchema()`** — generates a TypeScript Drizzle schema file from registered models
- **CLI** — `npx crudora generate-schema` writes the schema file to disk
- **PUT vs PATCH semantics** — PUT enforces all required fields (strict Zod); PATCH accepts any subset (partial Zod)
- **`getTable(ModelClass)`** on `Crudora` — returns the Drizzle table object for a registered model
- **`getTable(ModelClass)`** on `CrudoraServer` — delegates to the underlying `Crudora` instance
- **postinstall skip guards** — exits early when `CRUDORA_SKIP_POSTINSTALL=1` or `CI=true` is set; warns if `drizzle-orm` is not in `dependencies`

### Changed
- `afterFind` hook now always receives **and returns** `any[]` — the single-record branch is gone; `findById` and `findOne` wrap the record in an array before calling the hook
- Validation fallback (no `@Field()` decorators, only `fillable`) now treats fields as **optional** strings instead of required — let the DB enforce constraints when types are unknown
- Error envelope changed from `{ success: false, error: string }` to `{ success: false, error: { code, message, details? } }`

### Fixed
- `createMany()` result order now matches input insertion order
- `update()` on soft-delete models correctly distinguishes "not found" from "soft-deleted" before updating
- `findWithCursor()` composite cursor condition prevents skipping rows with equal cursor-field values
- Schema generator properly escapes single-quotes and backslashes in field names and enum values
- `fillable` + `@Field()` intersection — validation only covers fillable fields; fields set via lifecycle hooks are not required in request bodies
- Query-param keys are sanitized with `SAFE_KEY_RE` to prevent prototype-pollution
- `_like` search terms are capped at 200 characters to limit regex cost
- `_in` lists are capped at 500 values
- `select` and `with` query params are validated against `SAFE_KEY_RE`
- Transaction registry rebuild no longer uses `as any` mutation — registry is passed by reference at construction time

### Removed
- Prisma dependency and `prisma/schema.prisma`
- `generatePrismaSchema()` method (replaced by `generateDrizzleSchema()`)

---

## [0.1.0] — 2025-05-01

Initial public release.
