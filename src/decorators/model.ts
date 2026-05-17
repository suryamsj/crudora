import 'reflect-metadata';
import { FieldOptions, ModelOptions, RelationDefinition, RelationType } from '../types/model.type';

const MODEL_METADATA_KEY = Symbol('model');
const FIELD_METADATA_KEY = Symbol('field');

export function Model(options: ModelOptions = {}) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    Reflect.defineMetadata(MODEL_METADATA_KEY, {
      tableName: options.tableName || constructor.name.toLowerCase(),
      timestamps: options.timestamps !== false,
      constructor
    }, constructor);
    return constructor;
  };
}

export function Field(options: FieldOptions) {
  return function (target: any, context: any) {
    // Support both old and new decorator syntax
    if (typeof context === 'string') {
      // Old decorator syntax (target, propertyKey)
      const propertyKey = context;
      const existingFields = Reflect.getMetadata(FIELD_METADATA_KEY, target.constructor) || {};
      existingFields[propertyKey] = options;
      Reflect.defineMetadata(FIELD_METADATA_KEY, existingFields, target.constructor);
    } else {
      // New decorator syntax (target, context)
      const propertyKey = context.name;
      const constructor = target.constructor;
      const existingFields = Reflect.getMetadata(FIELD_METADATA_KEY, constructor) || {};
      existingFields[propertyKey] = options;
      Reflect.defineMetadata(FIELD_METADATA_KEY, existingFields, constructor);
    }
  };
}

export function getModelMetadata(target: any) {
  return Reflect.getMetadata(MODEL_METADATA_KEY, target);
}

export function getFieldMetadata(target: any) {
  return Reflect.getMetadata(FIELD_METADATA_KEY, target) || {};
}

// ─── Relation decorators ──────────────────────────────────────────────────────

const RELATION_METADATA_KEY = Symbol('relations');

function defineRelation(type: RelationType, model: () => any, foreignKey: string, relatedKey?: string) {
  return function (target: any, propertyKey: string) {
    const constructor = target.constructor;
    const existing: Record<string, RelationDefinition> =
      Reflect.getMetadata(RELATION_METADATA_KEY, constructor) || {};
    existing[propertyKey] = { type, model, foreignKey, relatedKey };
    Reflect.defineMetadata(RELATION_METADATA_KEY, existing, constructor);
  };
}

/**
 * Declares a one-to-many relation.
 * @param model   Lazy getter returning the related model constructor.
 * @param foreignKey  Column on the **related** table that references this model.
 * @param localKey    Column on **this** table (defaults to this model's primary key).
 *
 * @example
 * class User extends Model {
 *   @HasMany(() => Post, 'authorId')
 *   posts?: Post[];
 * }
 */
export function HasMany(model: () => any, foreignKey: string, localKey?: string) {
  return defineRelation('hasMany', model, foreignKey, localKey);
}

/**
 * Declares a one-to-one relation where the FK lives on the related table.
 * @param model       Lazy getter returning the related model constructor.
 * @param foreignKey  Column on the **related** table that references this model.
 * @param localKey    Column on **this** table (defaults to primary key).
 *
 * @example
 * class User extends Model {
 *   @HasOne(() => Profile, 'userId')
 *   profile?: Profile;
 * }
 */
export function HasOne(model: () => any, foreignKey: string, localKey?: string) {
  return defineRelation('hasOne', model, foreignKey, localKey);
}

/**
 * Declares a many-to-one (or one-to-one) relation where the FK lives on **this** table.
 * @param model       Lazy getter returning the related model constructor.
 * @param foreignKey  Column on **this** table that holds the FK value.
 * @param ownerKey    Column on the **related** table being pointed to (defaults to its primary key).
 *
 * @example
 * class Post extends Model {
 *   @BelongsTo(() => User, 'authorId')
 *   author?: User;
 * }
 */
export function BelongsTo(model: () => any, foreignKey: string, ownerKey?: string) {
  return defineRelation('belongsTo', model, foreignKey, ownerKey);
}

/**
 * Declares a many-to-many relation through a pivot/junction model.
 * @param model            Lazy getter returning the **related** model constructor.
 * @param pivotModel       Lazy getter returning the **pivot** model constructor.
 * @param pivotForeignKey  Column on the pivot table that references **this** model.
 * @param pivotRelatedKey  Column on the pivot table that references the **related** model.
 * @param localKey         Override for this model's local key (defaults to primary key).
 *
 * @example
 * class User extends Model {
 *   @BelongsToMany(() => Role, () => UserRole, 'userId', 'roleId')
 *   roles?: Role[];
 * }
 */
export function BelongsToMany(
  model: () => any,
  pivotModel: () => any,
  pivotForeignKey: string,
  pivotRelatedKey: string,
  localKey?: string,
) {
  return function (target: any, propertyKey: string) {
    const constructor = target.constructor;
    const existing: Record<string, RelationDefinition> =
      Reflect.getMetadata(RELATION_METADATA_KEY, constructor) || {};
    existing[propertyKey] = {
      type: 'belongsToMany',
      model,
      foreignKey: pivotForeignKey,
      relatedKey: localKey,
      pivotModel,
      pivotRelatedKey,
    };
    Reflect.defineMetadata(RELATION_METADATA_KEY, existing, constructor);
  };
}

export function getRelationMetadata(target: any): Record<string, RelationDefinition> {
  return Reflect.getMetadata(RELATION_METADATA_KEY, target) || {};
}
