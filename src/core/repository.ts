import {
  eq, and, or, gt, gte, lt, lte, like, ne, inArray,
  count as drizzleCount, getTableColumns, isNull, asc, desc,
} from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { Model, ModelConstructor } from './model';
import { getRelationMetadata } from '../decorators/model';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Fields managed by the ORM — never writable via user input. */
const SYSTEM_FIELDS = ['createdAt', 'updatedAt', 'deletedAt'] as const;

/** Maximum number of values allowed in a single _in filter. */
const MAX_IN_VALUES = 500;

/** Maximum character length for a _like search term. */
const MAX_LIKE_LENGTH = 200;

/** Maximum number of relations that can be loaded in a single query. */
const MAX_RELATIONS = 5;

/** Maximum rows per INSERT batch in createMany. */
const INSERT_BATCH_SIZE = 500;

/** Validates a where-clause key: column name with optional operator suffix. */
const SAFE_KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(_gt|_gte|_lt|_lte|_ne|_like|_in)?$/;

// ─── Advanced filter operators ────────────────────────────────────────────────

const OPERATOR_MAP: Record<string, (col: any, val: any) => any> = {
  _gt:   (col, val) => gt(col, val),
  _gte:  (col, val) => gte(col, val),
  _lt:   (col, val) => lt(col, val),
  _lte:  (col, val) => lte(col, val),
  _ne:   (col, val) => ne(col, val),
  _like: (col, val) => like(col, `%${String(val).slice(0, MAX_LIKE_LENGTH)}%`),
  // _in splits on literal commas. Values that contain commas must be URL-encoded (%2C)
  // before reaching this layer. This is safe for UUID/integer FK values which never contain commas.
  _in:   (col, val) => inArray(col, String(val).split(',').filter((v) => v !== '').slice(0, MAX_IN_VALUES)),
};

// ─── Cursor helpers ───────────────────────────────────────────────────────────

function encodeCursor(cursorField: string, cursorValue: any, pk: string, pkValue: any): string {
  return Buffer.from(JSON.stringify({ [cursorField]: cursorValue, [pk]: pkValue })).toString('base64');
}

function decodeCursor(cursor: string): Record<string, any> {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  } catch {
    return {};
  }
}

// ─── FindAll options ──────────────────────────────────────────────────────────

export interface FindAllOptions {
  skip?: number;
  take?: number;
  where?: Record<string, any>;
  orderBy?: string | string[];
  order?: 'asc' | 'desc' | Array<'asc' | 'desc'>;
  select?: string[];
  with?: string[];
  withDeleted?: boolean;
  /** When true, fields listed in `static hidden` are included in the result. */
  includeHidden?: boolean;
}

export interface FindByIdOptions {
  select?: string[];
  with?: string[];
  withDeleted?: boolean;
  /** When true, fields listed in `static hidden` are included in the result. */
  includeHidden?: boolean;
}

export interface CursorPaginationOptions {
  take?: number;
  cursor?: string | null;
  cursorField?: string;
  order?: 'asc' | 'desc';
  where?: Record<string, any>;
  select?: string[];
  with?: string[];
  withDeleted?: boolean;
  /** When true, fields listed in `static hidden` are included in the result. */
  includeHidden?: boolean;
}

export interface CursorResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class Repository<T extends Model> {
  constructor(
    private modelClass: ModelConstructor<T>,
    private db: any,
    private table: any,
    /** Shared registry — same Map instance as Crudora holds; populated lazily. */
    private registry?: Map<string, Repository<any>>,
  ) {}

  // ─── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Builds the Drizzle select-column object, merging hidden-field exclusion with
   * an optional explicit field list. Returns `undefined` to select all columns.
   */
  private buildSelectCols(selectFields?: string[], includeHidden = false): Record<string, any> | undefined {
    const hidden = [
      ...(includeHidden ? [] : (this.modelClass.hidden ?? [])),
      // deletedAt is an internal implementation detail — never expose it by default
      ...(this.modelClass.softDelete ? ['deletedAt'] : []),
    ];
    if (!hidden.length && !selectFields?.length) return undefined;

    const all = getTableColumns(this.table);
    let entries = Object.entries(all).filter(([col]) => !hidden.includes(col));

    if (selectFields?.length) {
      entries = entries.filter(([col]) => selectFields.includes(col));
    }

    return Object.fromEntries(entries);
  }

  private buildWhere(where?: Record<string, any>): any {
    if (!where) return undefined;
    const cols = this.table as any;
    const conds: any[] = [];

    for (const [key, val] of Object.entries(where)) {
      // Prototype-pollution guard + key whitelist
      if (!Object.prototype.hasOwnProperty.call(where, key)) continue;
      if (!SAFE_KEY_RE.test(key)) continue;
      if (val === undefined || val === '') continue;

      const suffix = Object.keys(OPERATOR_MAP).find((op) => key.endsWith(op));
      if (suffix) {
        const colName = key.slice(0, -suffix.length);
        if (Object.prototype.hasOwnProperty.call(cols, colName)) {
          conds.push(OPERATOR_MAP[suffix](cols[colName], val));
        }
      } else {
        if (Object.prototype.hasOwnProperty.call(cols, key)) {
          conds.push(eq(cols[key], val));
        }
      }
    }

    if (conds.length === 0) return undefined;
    return conds.length === 1 ? conds[0] : and(...conds);
  }

  private softDeleteClause(): any {
    if (!this.modelClass.softDelete) return undefined;
    const cols = this.table as any;
    if (!cols.deletedAt) {
      throw new Error(
        `Model "${this.modelClass.name}" has softDelete enabled but the table is missing a "deletedAt" column.`,
      );
    }
    return isNull(cols.deletedAt);
  }

  private combineWhere(...clauses: any[]): any {
    const active = clauses.filter(Boolean);
    if (active.length === 0) return undefined;
    if (active.length === 1) return active[0];
    return and(...active);
  }

  // ─── Relation loading ───────────────────────────────────────────────────────

  /**
   * Batch-loads relations for a list of records. Uses the _in operator so the
   * total number of DB round-trips equals the number of requested relations.
   */
  private async loadRelations(items: any[], withRelations: string[]): Promise<any[]> {
    if (!this.registry || !items.length || !withRelations.length) return items;

    const relDefs = getRelationMetadata(this.modelClass);
    let result = [...items];

    for (const relName of withRelations.slice(0, MAX_RELATIONS)) {
      const relDef = relDefs[relName];
      if (!relDef) continue;

      const RelModel = relDef.model();
      const relRepo = this.registry.get(RelModel.name);
      if (!relRepo) continue;

      const pk = this.modelClass.getPrimaryKey();

      if (relDef.type === 'hasMany' || relDef.type === 'hasOne') {
        const localKey = relDef.relatedKey ?? pk;
        const localVals = [...new Set<any>(result.map((r) => r[localKey]).filter(Boolean))];
        if (!localVals.length) {
          result = result.map((r) => ({ ...r, [relName]: relDef.type === 'hasOne' ? null : [] }));
          continue;
        }

        const related = await relRepo.findAll({
          where: { [`${relDef.foreignKey}_in`]: localVals.join(',') },
        });

        result = result.map((r) => {
          const matches = related.filter((rel: any) => rel[relDef.foreignKey] === r[localKey]);
          return { ...r, [relName]: relDef.type === 'hasOne' ? (matches[0] ?? null) : matches };
        });
      } else if (relDef.type === 'belongsTo') {
        const ownerKey = relDef.relatedKey ?? RelModel.getPrimaryKey();
        const fkVals = [...new Set<any>(result.map((r) => r[relDef.foreignKey]).filter(Boolean))];
        if (!fkVals.length) {
          result = result.map((r) => ({ ...r, [relName]: null }));
          continue;
        }

        const related = await relRepo.findAll({
          where: { [`${ownerKey}_in`]: fkVals.join(',') },
        });

        result = result.map((r) => {
          const match = related.find((rel: any) => rel[ownerKey] === r[relDef.foreignKey]);
          return { ...r, [relName]: match ?? null };
        });
      } else if (relDef.type === 'belongsToMany') {
        const localKey = relDef.relatedKey ?? pk;
        const localVals = [...new Set<any>(result.map((r) => r[localKey]).filter(Boolean))];
        if (!localVals.length) {
          result = result.map((r) => ({ ...r, [relName]: [] }));
          continue;
        }

        const PivotModel = relDef.pivotModel!();
        const pivotRepo = this.registry.get(PivotModel.name);
        if (!pivotRepo) continue;

        const pivotRows = await pivotRepo.findAll({
          where: { [`${relDef.foreignKey}_in`]: localVals.join(',') },
        });

        const relatedIds = [
          ...new Set<any>(pivotRows.map((p: any) => p[relDef.pivotRelatedKey!]).filter(Boolean)),
        ];
        if (!relatedIds.length) {
          result = result.map((r) => ({ ...r, [relName]: [] }));
          continue;
        }

        const relatedPk = RelModel.getPrimaryKey();
        const relatedRows = await relRepo.findAll({
          where: { [`${relatedPk}_in`]: relatedIds.join(',') },
        });

        result = result.map((r) => {
          const myPivots = pivotRows.filter((p: any) => p[relDef.foreignKey] === r[localKey]);
          const myIds = new Set(myPivots.map((p: any) => p[relDef.pivotRelatedKey!]));
          return { ...r, [relName]: relatedRows.filter((rel: any) => myIds.has(rel[relatedPk])) };
        });
      }
    }

    return result;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async create(data: Partial<T>): Promise<T> {
    let processed: any = { ...data };

    // Strip system-managed fields — never allow user to set these
    for (const f of SYSTEM_FIELDS) delete processed[f];

    if (this.modelClass.beforeCreate) {
      processed = await this.modelClass.beforeCreate(processed);
    }

    const pkField = this.modelClass.getPrimaryKey();
    if (!processed[pkField]) {
      processed[pkField] = randomUUID();
    }

    // Strip again after hook — prevents hook from re-injecting system fields
    for (const f of SYSTEM_FIELDS) delete processed[f];

    await this.db.insert(this.table).values(processed);
    const result = await this.findById(processed[pkField]);
    if (!result) throw new Error(`Create failed: could not retrieve record after insert (id: ${processed[pkField]})`);

    let final: any = result;
    if (this.modelClass.afterCreate) {
      final = await this.modelClass.afterCreate(processed, result);
    }
    return final;
  }

  async findById(id: string, opts?: FindByIdOptions): Promise<T | null> {
    const pk = this.modelClass.getPrimaryKey();
    const selectCols = this.buildSelectCols(opts?.select, opts?.includeHidden);

    // Note: only the `where` key of the beforeFind return value is respected here.
    // Properties like `skip`, `take`, and `orderBy` are ignored — they are only
    // meaningful in findAll(). Use afterFind to transform the result instead.
    let hookOptions: any = { where: { [pk]: id } };
    if (this.modelClass.beforeFind) {
      hookOptions = await this.modelClass.beforeFind(hookOptions);
    }

    const extraWhere = this.buildWhere(hookOptions?.where ? { ...hookOptions.where, [pk]: undefined } : undefined);

    let query = selectCols
      ? this.db.select(selectCols).from(this.table)
      : this.db.select().from(this.table);

    const whereClause = this.combineWhere(
      eq((this.table as any)[pk], id),
      opts?.withDeleted ? undefined : this.softDeleteClause(),
      extraWhere,
    );
    query = query.where(whereClause).limit(1);

    const [result] = await query;
    let found: any = result ?? null;

    if (found && this.modelClass.afterFind) {
      [found] = await this.modelClass.afterFind([found]);
    }

    if (found && opts?.with?.length) {
      const [withResult] = await this.loadRelations([found], opts.with);
      return withResult ?? null;
    }

    return found;
  }

  async findAll(options?: FindAllOptions): Promise<T[]> {
    let queryOptions = options ? { ...options } : undefined;
    if (this.modelClass.beforeFind) {
      queryOptions = await this.modelClass.beforeFind(queryOptions);
    }

    const selectCols = this.buildSelectCols(queryOptions?.select, queryOptions?.includeHidden);
    const whereClause = this.combineWhere(
      this.buildWhere(queryOptions?.where),
      queryOptions?.withDeleted ? undefined : this.softDeleteClause(),
    );

    let query = selectCols
      ? this.db.select(selectCols).from(this.table)
      : this.db.select().from(this.table);

    if (whereClause) query = query.where(whereClause);

    if (queryOptions?.orderBy) {
      const fields = Array.isArray(queryOptions.orderBy) ? queryOptions.orderBy : [queryOptions.orderBy];
      const orders = Array.isArray(queryOptions.order) ? queryOptions.order : [queryOptions.order ?? 'asc'];
      const orderClauses = fields
        .map((field, i) => {
          // Validate field name before property access to prevent prototype traversal
          if (!SAFE_KEY_RE.test(field)) return null;
          if (!Object.prototype.hasOwnProperty.call(this.table, field)) return null;
          const col = (this.table as any)[field];
          return (orders[i] ?? orders[0] ?? 'asc') === 'desc' ? desc(col) : asc(col);
        })
        .filter(Boolean);
      if (orderClauses.length) query = query.orderBy(...orderClauses);
    }

    if (queryOptions?.skip !== undefined) query = query.offset(queryOptions.skip);
    if (queryOptions?.take !== undefined) query = query.limit(queryOptions.take);

    let results: any[] = await query;

    if (this.modelClass.afterFind) {
      results = await this.modelClass.afterFind(results);
    }

    if (queryOptions?.with?.length) {
      results = await this.loadRelations(results, queryOptions.with);
    }

    return results;
  }

  /**
   * Cursor-based pagination — more efficient than offset for large datasets.
   *
   * @example
   * const page1 = await userRepo.findWithCursor({ take: 10 });
   * const page2 = await userRepo.findWithCursor({ take: 10, cursor: page1.nextCursor });
   */
  async findWithCursor(options: CursorPaginationOptions): Promise<CursorResult<T>> {
    const {
      take = 10,
      cursor,
      order = 'asc',
      where,
      select,
      with: withRelations,
      withDeleted,
      includeHidden,
    } = options;

    const pk = this.modelClass.getPrimaryKey();
    // Validate cursorField against known columns to prevent prototype traversal
    const requestedCursorField = options.cursorField ?? pk;
    const cursorField =
      SAFE_KEY_RE.test(requestedCursorField) &&
      Object.prototype.hasOwnProperty.call(this.table, requestedCursorField)
        ? requestedCursorField
        : pk;
    const col = (this.table as any)[cursorField];
    const pkCol = (this.table as any)[pk];
    const cursorFieldIsPk = cursorField === pk;

    // Decode cursor — stores both cursorField value and pk value for composite tie-breaking
    let cursorValue: any = null;
    let cursorPkValue: any = null;
    if (cursor) {
      const decoded = decodeCursor(cursor);
      cursorValue = decoded[cursorField] ?? null;
      cursorPkValue = decoded[pk] ?? null;
    }

    // Build cursor condition.
    // When cursorField is non-unique, use a composite condition to avoid skipping
    // rows that share the same cursorField value:
    //   (cursorField > val) OR (cursorField = val AND pk > pkVal)
    let cursorCond: any = undefined;
    if (cursorValue !== null && col) {
      if (cursorFieldIsPk || cursorPkValue === null) {
        // PK is always unique — simple GT/LT is safe
        cursorCond = order === 'desc' ? lt(col, cursorValue) : gt(col, cursorValue);
      } else {
        cursorCond = or(
          order === 'desc' ? lt(col, cursorValue) : gt(col, cursorValue),
          and(
            eq(col, cursorValue),
            order === 'desc' ? lt(pkCol, cursorPkValue) : gt(pkCol, cursorPkValue),
          ),
        );
      }
    }

    const whereClause = this.combineWhere(
      this.buildWhere(where),
      withDeleted ? undefined : this.softDeleteClause(),
      cursorCond,
    );

    const selectCols = this.buildSelectCols(select, includeHidden);

    let query = selectCols
      ? this.db.select(selectCols).from(this.table)
      : this.db.select().from(this.table);

    if (whereClause) query = query.where(whereClause);

    // Sort by cursorField; add pk as tie-breaker when cursorField is non-unique
    if (col) {
      query = !cursorFieldIsPk && pkCol
        ? query.orderBy(order === 'desc' ? desc(col) : asc(col), order === 'desc' ? desc(pkCol) : asc(pkCol))
        : query.orderBy(order === 'desc' ? desc(col) : asc(col));
    }

    // Fetch one extra to detect whether there are more pages
    query = query.limit(take + 1);

    let results: any[] = await query;

    const hasMore = results.length > take;
    const data: any[] = hasMore ? results.slice(0, take) : results;

    const nextCursor =
      hasMore && data.length > 0
        ? encodeCursor(cursorField, data[data.length - 1][cursorField], pk, data[data.length - 1][pk])
        : null;

    if (this.modelClass.afterFind) {
      const processed = await this.modelClass.afterFind(data);
      const finalData = withRelations?.length
        ? await this.loadRelations(processed, withRelations)
        : processed;
      return { data: finalData, nextCursor, hasMore };
    }

    const finalData = withRelations?.length
      ? await this.loadRelations(data, withRelations)
      : data;

    return { data: finalData, nextCursor, hasMore };
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    let processed: any = { ...data };

    // Strip fields that must never be overwritten by user input
    const pk = this.modelClass.getPrimaryKey();
    delete processed[pk];
    delete processed['createdAt'];
    delete processed['deletedAt'];

    if (this.modelClass.beforeUpdate) {
      processed = await this.modelClass.beforeUpdate(id, processed);
    }

    // Strip again after hook — prevents hook from re-injecting immutable fields
    delete processed[pk];
    delete processed['createdAt'];
    delete processed['deletedAt'];

    // Guard before timestamp injection — empty body truly short-circuits here
    if (Object.keys(processed).length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new NotFoundError(`Record with id "${id}" not found`);
      return existing;
    }

    if (this.modelClass.timestamps !== false) {
      const cols = getTableColumns(this.table);
      if ('updatedAt' in cols) {
        processed.updatedAt = new Date();
      }
    }

    // For soft-delete models, distinguish "not found" from "soft-deleted" before updating
    if (this.modelClass.softDelete) {
      const tbl = this.table as any;
      const [row] = await this.db
        .select({ _deleted: tbl.deletedAt })
        .from(this.table)
        .where(eq(tbl[pk], id))
        .limit(1);
      if (!row) throw new NotFoundError(`Record with id "${id}" not found`);
      if (row._deleted !== null && row._deleted !== undefined) {
        throw new NotFoundError(`Record with id "${id}" is soft-deleted and cannot be updated`);
      }
    }

    const updateWhere = this.combineWhere(
      eq((this.table as any)[pk], id),
      this.softDeleteClause(),
    );
    await this.db.update(this.table).set(processed).where(updateWhere);

    const result = await this.findById(id);
    if (!result) throw new NotFoundError(`Record with id "${id}" not found`);

    let final: any = result;
    if (this.modelClass.afterUpdate) {
      final = await this.modelClass.afterUpdate(id, processed, result);
    }
    return final;
  }

  async delete(id: string): Promise<T> {
    // Check existence first — beforeDelete must not fire for non-existent records
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError(`Record with id "${id}" not found`);

    if (this.modelClass.beforeDelete) {
      await this.modelClass.beforeDelete(id);
    }

    const pk = this.modelClass.getPrimaryKey();

    if (this.modelClass.softDelete) {
      await this.db
        .update(this.table)
        .set({ deletedAt: new Date() })
        .where(eq((this.table as any)[pk], id));
    } else {
      await this.db.delete(this.table).where(eq((this.table as any)[pk], id));
    }

    let final: any = existing;
    if (this.modelClass.afterDelete) {
      final = await this.modelClass.afterDelete(id, existing);
    }
    return final;
  }

  async hardDelete(id: string): Promise<T> {
    const existing = await this.findById(id, { withDeleted: true });
    if (!existing) throw new NotFoundError(`Record with id "${id}" not found`);
    const pk = this.modelClass.getPrimaryKey();
    await this.db.delete(this.table).where(eq((this.table as any)[pk], id));
    return existing;
  }

  async restore(id: string): Promise<T> {
    const pk = this.modelClass.getPrimaryKey();
    const cols = this.table as any;
    if (!cols.deletedAt) throw new Error('softDelete is not enabled on this model');

    // Fetch the raw row (including deletedAt) to verify it exists AND is soft-deleted
    const [raw] = await this.db.select().from(this.table)
      .where(eq(cols[pk], id)).limit(1);
    if (!raw) throw new NotFoundError(`Record with id "${id}" not found`);
    if (!raw.deletedAt) throw new Error(`Record with id "${id}" is not soft-deleted`);

    await this.db
      .update(this.table)
      .set({ deletedAt: null })
      .where(eq(cols[pk], id));

    const selectCols = this.buildSelectCols();
    let query = selectCols
      ? this.db.select(selectCols).from(this.table)
      : this.db.select().from(this.table);
    query = query.where(eq(cols[pk], id)).limit(1);
    const [result] = await query;
    return result ?? null;
  }

  async count(where?: any, withDeleted?: boolean): Promise<number> {
    const whereClause = this.combineWhere(
      this.buildWhere(where),
      withDeleted ? undefined : this.softDeleteClause(),
    );
    let query = this.db.select({ count: drizzleCount() }).from(this.table);
    if (whereClause) query = query.where(whereClause);
    const [result] = await query;
    return Number(result.count);
  }

  /** Returns the first record matching `where`, or null. Builds a direct LIMIT 1 query — does not delegate to findAll. */
  async findOne(where?: Record<string, any>, opts?: FindByIdOptions): Promise<T | null> {
    const selectCols = this.buildSelectCols(opts?.select, opts?.includeHidden);
    const whereClause = this.combineWhere(
      this.buildWhere(where),
      opts?.withDeleted ? undefined : this.softDeleteClause(),
    );

    let query = selectCols
      ? this.db.select(selectCols).from(this.table)
      : this.db.select().from(this.table);

    if (whereClause) query = query.where(whereClause);
    query = query.limit(1);

    const [result] = await query;
    let found: any = result ?? null;

    if (found && this.modelClass.afterFind) {
      [found] = await this.modelClass.afterFind([found]);
    }

    if (found && opts?.with?.length) {
      const [withResult] = await this.loadRelations([found], opts.with);
      return withResult ?? null;
    }

    return found;
  }

  /**
   * Returns true if at least one record matches `where`.
   * Uses SELECT pk LIMIT 1 — more efficient than COUNT(*) because the DB stops at the first match.
   */
  async exists(where?: Record<string, any>, withDeleted?: boolean): Promise<boolean> {
    const pk = this.modelClass.getPrimaryKey();
    const whereClause = this.combineWhere(
      this.buildWhere(where),
      withDeleted ? undefined : this.softDeleteClause(),
    );

    let query = this.db.select({ _pk: (this.table as any)[pk] }).from(this.table);
    if (whereClause) query = query.where(whereClause);
    query = query.limit(1);

    const [result] = await query;
    return result !== undefined;
  }

  /**
   * Inserts multiple records in a single INSERT statement.
   * Calls `beforeCreate` for each row. Calls `afterCreateMany` once with all
   * results — use this hook for batch-aware side effects (e.g. bulk notifications).
   * Individual `afterCreate` is intentionally NOT called per row for performance.
   */
  async createMany(data: Partial<T>[]): Promise<T[]> {
    if (data.length === 0) return [];

    const pk = this.modelClass.getPrimaryKey();

    const processed = await Promise.all(
      data.map(async (item) => {
        let row: any = { ...item };
        for (const f of SYSTEM_FIELDS) delete row[f];
        if (this.modelClass.beforeCreate) {
          row = await this.modelClass.beforeCreate(row);
        }
        // Strip again after hook — mirrors the defense-in-depth in create()
        for (const f of SYSTEM_FIELDS) delete row[f];
        if (!row[pk]) row[pk] = randomUUID();
        return row;
      }),
    );

    // Batch inserts to avoid DB packet/lock limits
    for (let i = 0; i < processed.length; i += INSERT_BATCH_SIZE) {
      await this.db.insert(this.table).values(processed.slice(i, i + INSERT_BATCH_SIZE));
    }

    // Fetch results in batches matching MAX_IN_VALUES so >500 inserts all return
    const pks = processed.map((r) => r[pk]);
    const results: T[] = [];
    for (let i = 0; i < pks.length; i += MAX_IN_VALUES) {
      const batch = pks.slice(i, i + MAX_IN_VALUES);
      const rows = await this.findAll({ where: { [`${pk}_in`]: batch.join(',') } });
      results.push(...rows);
    }

    // Re-order to match input insertion order — DB IN queries don't guarantee row order
    const pkOrder = new Map(pks.map((id, i) => [id, i]));
    results.sort((a, b) => (pkOrder.get((a as any)[pk]) ?? 0) - (pkOrder.get((b as any)[pk]) ?? 0));

    if (this.modelClass.afterCreateMany) {
      return this.modelClass.afterCreateMany(results);
    }
    return results;
  }

  /**
   * Runs `fn` inside a database transaction. The callback receives a new
   * Repository bound to the transaction connection.
   *
   * @example
   * await userRepo.transaction(async (trx) => {
   *   await trx.create({ name: 'Alice' });
   *   await trx.update(id, { name: 'Bob' });
   * });
   */
  async transaction<R>(fn: (trx: Repository<T>) => Promise<R>): Promise<R> {
    return this.db.transaction(async (trx: any) => {
      // Rebuild the registry so every relation load inside the transaction
      // uses the same transactional connection — not the outer db connection.
      //
      // Pass `trxRegistry` by reference at construction time so all repos
      // share the same Map. Lookups happen lazily (in loadRelations), so
      // the Map is fully populated before any repo needs to use it.
      let trxRegistry: Map<string, Repository<any>> | undefined;

      if (this.registry) {
        trxRegistry = new Map<string, Repository<any>>();
        for (const [name, repo] of this.registry.entries()) {
          trxRegistry.set(name, new Repository(repo.modelClass, trx, repo.table, trxRegistry));
        }
      }

      return fn(new Repository(this.modelClass, trx, this.table, trxRegistry));
    });
  }
}
