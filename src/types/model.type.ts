export type FieldType =
  | 'string'
  | 'text'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'date'
  | 'uuid'
  | 'decimal'
  | 'json'
  | 'enum'
  | 'bigint'
  | 'serial'
  | 'array';

export interface FieldOptions {
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  default?: any;
  length?: number;
  primary?: boolean;
  nullable?: boolean;
  precision?: number;
  scale?: number;
  /** Required when type is 'enum'. Lists the allowed values. */
  enumValues?: string[];
}

export interface ModelOptions {
  tableName?: string;
  timestamps?: boolean;
}

export type Dialect = 'postgresql' | 'mysql';

export type RelationType = 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';

export interface RelationDefinition {
  type: RelationType;
  /** Lazy model getter — avoids circular-import issues */
  model: () => any;
  /** The foreign-key column name */
  foreignKey: string;
  /**
   * hasOne / hasMany: column on the owning (local) side. Defaults to the model's primary key.
   * belongsTo   : column on the related side (the "owner"). Defaults to the related model's primary key.
   * belongsToMany: override for this model's local key (defaults to primary key).
   */
  relatedKey?: string;
  // ── belongsToMany only ──────────────────────────────────────────────────────
  /** Lazy getter returning the pivot/junction model constructor. */
  pivotModel?: () => any;
  /** Column on the pivot table that points to the **related** model. */
  pivotRelatedKey?: string;
}
