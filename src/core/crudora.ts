import { Express } from 'express';
import { z } from 'zod';
import { Repository, NotFoundError } from './repository';
import { SchemaGenerator } from './schemaGenerator';
import { ValidationGenerator } from '../utils/validation';
import { Model, ModelConstructor } from './model';
import { DrizzleTableBuilder } from './drizzleTableBuilder';
import { Dialect } from '../types/model.type';
import { CrudoraLogger } from '../types/logger.type';

const MAX_LIMIT = 1000;
const MAX_RELATIONS = 5;
/** Validates a query-param key: alphanumeric/underscore with optional operator suffix. */
const SAFE_KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(_gt|_gte|_lt|_lte|_ne|_like|_in)?$/;

// ─── Response helpers ─────────────────────────────────────────────────────────

function ok(data: any, meta?: Record<string, any>) {
  return meta !== undefined ? { success: true, data, meta } : { success: true, data };
}

function fail(code: string, message: string, details?: any[]) {
  const error: Record<string, any> = { code, message };
  if (details !== undefined) error.details = details;
  return { success: false, error };
}

function zodDetails(issues: z.ZodError['issues']) {
  return issues.map((issue) => ({
    field: issue.path.length ? issue.path.join('.') : '_root',
    message: issue.message,
  }));
}

export class Crudora {
  private db: any;
  private dialect: Dialect;
  private logger: CrudoraLogger | undefined;
  private models: Map<string, ModelConstructor> = new Map();
  private tables: Map<string, any> = new Map();
  private repositories: Map<string, Repository<any>> = new Map();
  private customRoutes: Array<{
    method: string;
    path: string;
    handlers: Array<(req: any, res: any, next?: any) => void>;
  }> = [];

  constructor(db: any, dialect: Dialect, logger?: CrudoraLogger) {
    if (!db) {
      throw new Error(
        'Crudora: db is required. Provide a Drizzle db instance:\n' +
        '  import { drizzle } from "drizzle-orm/node-postgres";\n' +
        '  import { Pool } from "pg";\n' +
        '  const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));',
      );
    }
    if (typeof db.select !== 'function' || typeof db.insert !== 'function') {
      throw new Error(
        'Crudora: the provided db object does not look like a Drizzle ORM instance. ' +
        'Make sure drizzle-orm is installed (npm install drizzle-orm) and that you are ' +
        'passing the result of drizzle(pool) or drizzle(client), not a raw pool/connection.',
      );
    }
    this.db = db;
    this.dialect = dialect;
    this.logger = logger;
  }

  registerModel(...modelClasses: ModelConstructor[]): this {
    for (const modelClass of modelClasses) {
      const table = DrizzleTableBuilder.build(modelClass, this.dialect);
      // Pass the shared repositories Map so each repo can resolve siblings lazily
      const repository = new Repository(modelClass, this.db, table, this.repositories);
      this.models.set(modelClass.name, modelClass);
      this.tables.set(modelClass.name, table);
      this.repositories.set(modelClass.name, repository);
    }
    return this;
  }

  /**
   * Register a model against a pre-built Drizzle table object (e.g. from `drizzle-kit introspect`).
   * Skips `DrizzleTableBuilder` — useful when the database already exists and the schema
   * was generated via introspection rather than Crudora decorators.
   *
   * Validation works if the model defines `@Field()` decorators matching the table columns.
   * Without decorators, POST/PUT bodies pass through without Zod validation.
   */
  registerTable<T extends Model>(modelClass: ModelConstructor<T>, table: any): this {
    const repository = new Repository(modelClass, this.db, table, this.repositories);
    this.models.set(modelClass.name, modelClass);
    this.tables.set(modelClass.name, table);
    this.repositories.set(modelClass.name, repository);
    return this;
  }

  getRepository<T extends Model>(modelClass: ModelConstructor<T>): Repository<T> {
    const repository = this.repositories.get(modelClass.name);
    if (!repository) {
      throw new Error(`Repository for ${modelClass.name} not found. Did you register the model?`);
    }
    return repository;
  }

  /**
   * Returns the Drizzle table object for a registered model.
   * Useful for raw queries that need access to columns excluded by `hidden`
   * (e.g. fetching a password hash for authentication).
   *
   * @example
   * const usersTable = crudora.getTable(User);
   * const [row] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
   */
  getTable<T extends Model>(modelClass: ModelConstructor<T>): any {
    const table = this.tables.get(modelClass.name);
    if (!table) {
      throw new Error(`Table for ${modelClass.name} not found. Did you register the model?`);
    }
    return table;
  }

  generateDrizzleSchema(): string {
    const modelClasses = Array.from(this.models.values());
    return SchemaGenerator.generateDrizzleSchema(modelClasses, this.dialect);
  }

  getValidationSchema<T extends Model>(modelClass: ModelConstructor<T>): z.ZodType<Partial<T>> {
    return ValidationGenerator.generateZodSchema(modelClass as any);
  }

  getStrictValidationSchema<T extends Model>(modelClass: ModelConstructor<T>): z.ZodType<T> {
    return ValidationGenerator.generateStrictZodSchema(modelClass as any);
  }

  get(path: string, ...handlers: Array<(req: any, res: any, next?: any) => void>): this {
    this.customRoutes.push({ method: 'GET', path, handlers });
    return this;
  }

  post(path: string, ...handlers: Array<(req: any, res: any, next?: any) => void>): this {
    this.customRoutes.push({ method: 'POST', path, handlers });
    return this;
  }

  put(path: string, ...handlers: Array<(req: any, res: any, next?: any) => void>): this {
    this.customRoutes.push({ method: 'PUT', path, handlers });
    return this;
  }

  delete(path: string, ...handlers: Array<(req: any, res: any, next?: any) => void>): this {
    this.customRoutes.push({ method: 'DELETE', path, handlers });
    return this;
  }

  patch(path: string, ...handlers: Array<(req: any, res: any, next?: any) => void>): this {
    this.customRoutes.push({ method: 'PATCH', path, handlers });
    return this;
  }

  /** Runs `fn` inside a database transaction and returns its result. */
  async transaction<R>(fn: (db: any) => Promise<R>): Promise<R> {
    return this.db.transaction(fn);
  }

  generateRoutes(app: Express, basePath: string = '/api'): void {
    // Route discovery endpoint
    app.get(basePath, (_req, res) => {
      const routes: any[] = [];

      for (const [, modelClass] of this.models) {
        const routePath = `${basePath}/${modelClass.getTableName()}`;
        routes.push(
          { method: 'GET',    path: routePath,          description: `List all ${modelClass.getTableName()}`,              type: 'CRUD' },
          { method: 'GET',    path: `${routePath}/:id`, description: `Get ${modelClass.getTableName()} by ID`,             type: 'CRUD' },
          { method: 'POST',   path: routePath,          description: `Create new ${modelClass.getTableName()}`,            type: 'CRUD' },
          { method: 'PUT',    path: `${routePath}/:id`, description: `Replace ${modelClass.getTableName()} by ID`,         type: 'CRUD' },
          { method: 'PATCH',  path: `${routePath}/:id`, description: `Partial update ${modelClass.getTableName()} by ID`, type: 'CRUD' },
          { method: 'DELETE', path: `${routePath}/:id`, description: `Delete ${modelClass.getTableName()} by ID`,         type: 'CRUD' },
        );
      }

      for (const route of this.customRoutes) {
        routes.push({
          method: route.method,
          path: `${basePath}${route.path}`,
          description: `Custom ${route.method} route`,
          type: 'Custom',
        });
      }

      res.json(ok({ routes }));
    });

    // CRUD routes per model
    for (const [, modelClass] of this.models) {
      const repository = this.getRepository(modelClass);
      const validationSchema = this.getValidationSchema(modelClass);
      const strictValidationSchema = this.getStrictValidationSchema(modelClass);
      const routePath = `${basePath}/${modelClass.getTableName()}`;

      // ── GET /resource ──────────────────────────────────────────────────────
      app.get(routePath, async (req, res) => {
        try {
          const {
            page,
            limit = '10',
            orderBy,
            order,
            cursor,        // presence triggers cursor mode
            cursorField,
            select,        // comma-separated field names
            with: withStr, // comma-separated relation names
            withDeleted,
            ...filters
          } = req.query as Record<string, string>;

          const selectFields = select
            ? select.split(',').map((f) => f.trim()).filter((f) => SAFE_KEY_RE.test(f))
            : undefined;
          const withRelations = withStr
            ? withStr.split(',').map((r) => r.trim()).filter((r) => SAFE_KEY_RE.test(r)).slice(0, MAX_RELATIONS)
            : undefined;

          // Sanitize filter keys to prevent prototype pollution
          const safeFilters: Record<string, string> = {};
          for (const [k, v] of Object.entries(filters)) {
            if (SAFE_KEY_RE.test(k)) safeFilters[k] = v;
          }
          const whereFilters = Object.keys(safeFilters).length ? safeFilters : undefined;

          // Clamp limit: reject NaN, 0, negatives; cap at MAX_LIMIT
          const rawLimit = Number(limit);
          const limitNum = Number.isFinite(rawLimit) && rawLimit > 0
            ? Math.min(rawLimit, MAX_LIMIT)
            : 10;
          const includeDeleted = withDeleted === 'true';

          // Multiple orderBy: ?orderBy=createdAt,name&order=desc,asc
          const orderByFields = orderBy ? orderBy.split(',').map((f) => f.trim()).filter(Boolean) : undefined;
          const orderValues = order
            ? (order.split(',').map((o) => o.trim()).filter(Boolean) as Array<'asc' | 'desc'>)
            : undefined;
          const orderByArg = orderByFields && orderByFields.length === 1 ? orderByFields[0] : orderByFields;
          const orderArg = orderValues && orderValues.length === 1 ? orderValues[0] : orderValues;

          if (cursor !== undefined) {
            // ── Cursor-based pagination ────────────────────────────────────
            const result = await repository.findWithCursor({
              take: limitNum,
              cursor: cursor || null,
              cursorField,
              order: (orderValues?.[0]) ?? (order === 'desc' ? 'desc' : 'asc'),
              where: whereFilters,
              select: selectFields,
              with: withRelations,
              withDeleted: includeDeleted,
            });
            return res.json(ok(result.data, {
              cursor: { next: result.nextCursor, hasMore: result.hasMore },
            }));
          }

          // ── Offset-based pagination ────────────────────────────────────
          const rawPage = Number(page ?? 1);
          const pageNum = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
          const skip = (pageNum - 1) * limitNum;

          const items = await repository.findAll({
            skip,
            take: limitNum,
            where: whereFilters,
            orderBy: orderByArg,
            order: orderArg,
            select: selectFields,
            with: withRelations,
            withDeleted: includeDeleted,
          });
          const total = await repository.count(whereFilters, includeDeleted);
          return res.json(ok(items, {
            pagination: { page: pageNum, limit: limitNum, total, pages: total === 0 ? 0 : Math.ceil(total / limitNum) },
          }));
        } catch (err) {
          this.logger?.error('GET request failed', {
            path: routePath,
            correlationId: (req as any).correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
          res.status(500).json(fail('INTERNAL_ERROR', 'Internal server error'));
        }
      });

      // ── GET /resource/:id ──────────────────────────────────────────────────
      app.get(`${routePath}/:id`, async (req, res) => {
        try {
          const { select, with: withStr, withDeleted } = req.query as Record<string, string>;
          const selectFields = select
            ? select.split(',').map((f) => f.trim()).filter((f) => SAFE_KEY_RE.test(f))
            : undefined;
          const withRelations = withStr
            ? withStr.split(',').map((r) => r.trim()).filter((r) => SAFE_KEY_RE.test(r)).slice(0, MAX_RELATIONS)
            : undefined;

          const item = await repository.findById(req.params.id, {
            select: selectFields,
            with: withRelations,
            withDeleted: withDeleted === 'true',
          });
          if (!item) return res.status(404).json(fail('NOT_FOUND', 'Resource not found'));
          return res.json(ok(item));
        } catch (err) {
          this.logger?.error('GET by ID request failed', {
            path: `${routePath}/:id`,
            id: req.params.id,
            correlationId: (req as any).correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
          res.status(500).json(fail('INTERNAL_ERROR', 'Internal server error'));
        }
      });

      // ── POST /resource ─────────────────────────────────────────────────────
      app.post(routePath, async (req, res) => {
        try {
          const validatedData = strictValidationSchema.parse(req.body);
          const item = await repository.create(validatedData);
          return res.status(201).json(ok(item));
        } catch (error) {
          if (error instanceof z.ZodError) {
            return res.status(422).json(fail('VALIDATION_ERROR', 'Validation failed', zodDetails(error.issues)));
          }
          this.logger?.error('POST request failed', {
            path: routePath,
            correlationId: (req as any).correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
          res.status(500).json(fail('INTERNAL_ERROR', 'Internal server error'));
        }
      });

      // ── PUT /resource/:id ──────────────────────────────────────────────────
      app.put(`${routePath}/:id`, async (req, res) => {
        try {
          const validatedData = strictValidationSchema.parse(req.body);
          const item = await repository.update(req.params.id, validatedData);
          return res.json(ok(item));
        } catch (error) {
          if (error instanceof NotFoundError) return res.status(404).json(fail('NOT_FOUND', error.message));
          if (error instanceof z.ZodError) {
            return res.status(422).json(fail('VALIDATION_ERROR', 'Validation failed', zodDetails(error.issues)));
          }
          this.logger?.error('PUT request failed', {
            path: `${routePath}/:id`,
            id: req.params.id,
            correlationId: (req as any).correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
          res.status(500).json(fail('INTERNAL_ERROR', 'Internal server error'));
        }
      });

      // ── PATCH /resource/:id ── partial update ─────────────────────────────
      app.patch(`${routePath}/:id`, async (req, res) => {
        try {
          const validatedData = validationSchema.parse(req.body);
          const item = await repository.update(req.params.id, validatedData);
          return res.json(ok(item));
        } catch (error) {
          if (error instanceof NotFoundError) return res.status(404).json(fail('NOT_FOUND', error.message));
          if (error instanceof z.ZodError) {
            return res.status(422).json(fail('VALIDATION_ERROR', 'Validation failed', zodDetails(error.issues)));
          }
          this.logger?.error('PATCH request failed', {
            path: `${routePath}/:id`,
            id: req.params.id,
            correlationId: (req as any).correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
          res.status(500).json(fail('INTERNAL_ERROR', 'Internal server error'));
        }
      });

      // ── DELETE /resource/:id ───────────────────────────────────────────────
      app.delete(`${routePath}/:id`, async (req, res) => {
        try {
          await repository.delete(req.params.id);
          return res.status(204).send();
        } catch (error) {
          if (error instanceof NotFoundError) return res.status(404).json(fail('NOT_FOUND', (error as Error).message));
          this.logger?.error('DELETE request failed', {
            path: `${routePath}/:id`,
            id: req.params.id,
            correlationId: (req as any).correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
          res.status(500).json(fail('INTERNAL_ERROR', 'Internal server error'));
        }
      });
    }

    // Custom routes
    for (const route of this.customRoutes) {
      const fullPath = `${basePath}${route.path}`;
      const { method, handlers } = route;
      switch (method.toLowerCase()) {
        case 'get':    app.get(fullPath, ...handlers);    break;
        case 'post':   app.post(fullPath, ...handlers);   break;
        case 'put':    app.put(fullPath, ...handlers);    break;
        case 'delete': app.delete(fullPath, ...handlers); break;
        case 'patch':  app.patch(fullPath, ...handlers);  break;
      }
    }
  }
}
