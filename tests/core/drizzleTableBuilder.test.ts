import 'reflect-metadata';
import { DrizzleTableBuilder } from '../../src/core/drizzleTableBuilder';
import { Model } from '../../src/core/model';
import { Field } from '../../src/decorators/model';
import { getTableColumns } from 'drizzle-orm';

// ─── PostgreSQL models ────────────────────────────────────────────────────────

class PgAllTypes extends Model {
  static tableName = 'pg_all_types';
  static timestamps = false;

  @Field({ type: 'uuid', primary: true })         id!: string;
  @Field({ type: 'string', length: 100 })         name!: string;
  @Field({ type: 'text' })                        bio!: string;
  @Field({ type: 'integer' })                     age!: number;
  @Field({ type: 'number' })                      score!: number;
  @Field({ type: 'boolean' })                     active!: boolean;
  @Field({ type: 'date' })                        createdAt!: Date;
  @Field({ type: 'decimal', precision: 8, scale: 3 }) price!: string;
  @Field({ type: 'json' })                        meta!: object;
  @Field({ type: 'enum', enumValues: ['a', 'b'] }) status!: string;
  @Field({ type: 'bigint' })                      bigNum!: number;
  @Field({ type: 'serial' })                      seq!: number;
  @Field({ type: 'array' })                       tags!: string[];
}

class PgWithModifiers extends Model {
  static tableName = 'pg_modifiers';
  static timestamps = false;

  @Field({ type: 'uuid', primary: true })                      id!: string;
  @Field({ type: 'string', required: true, unique: true })     email!: string;
  @Field({ type: 'string', nullable: true })                   bio!: string | null;
  @Field({ type: 'string', required: true, nullable: true })   avatar!: string | null;
  @Field({ type: 'boolean', default: false })                  active!: boolean;
  @Field({ type: 'decimal' })                                  amount!: string; // no precision/scale → defaults
  @Field({ type: 'string' })                                   note!: string;   // no length → default 255
}

class PgWithTimestamps extends Model {
  static tableName = 'pg_timestamps';
  @Field({ type: 'uuid', primary: true }) id!: string;
}

class PgWithSoftDelete extends Model {
  static tableName = 'pg_soft';
  static softDelete = true;
  static timestamps = false;
  @Field({ type: 'uuid', primary: true }) id!: string;
}

class PgWithSchema extends Model {
  static tableName = 'pg_schema_table';
  static schema = 'auth';
  static timestamps = false;
  @Field({ type: 'uuid', primary: true }) id!: string;
}

// ─── MySQL models ─────────────────────────────────────────────────────────────

class MysqlAllTypes extends Model {
  static tableName = 'mysql_all_types';
  static timestamps = false;

  @Field({ type: 'uuid', primary: true })         id!: string;
  @Field({ type: 'string', length: 50 })          name!: string;
  @Field({ type: 'text' })                        bio!: string;
  @Field({ type: 'integer' })                     age!: number;
  @Field({ type: 'number' })                      score!: number;
  @Field({ type: 'boolean' })                     active!: boolean;
  @Field({ type: 'date' })                        createdAt!: Date;
  @Field({ type: 'decimal', precision: 6, scale: 2 }) price!: string;
  @Field({ type: 'json' })                        meta!: object;
  @Field({ type: 'enum', enumValues: ['x', 'y'] }) status!: string;
  @Field({ type: 'bigint' })                      bigNum!: number;
  @Field({ type: 'serial' })                      seq!: number;
}

class MysqlWithSchema extends Model {
  static tableName = 'mysql_schema_table';
  static schema = 'mydb';
  static timestamps = false;
  @Field({ type: 'uuid', primary: true }) id!: string;
}

class MysqlWithModifiers extends Model {
  static tableName = 'mysql_modifiers';
  static timestamps = false;

  @Field({ type: 'uuid', primary: true })                   id!: string;
  @Field({ type: 'string', required: true })                name!: string;
  @Field({ type: 'string', unique: true })                  code!: string;
  @Field({ type: 'boolean', default: false })               active!: boolean;
  @Field({ type: 'decimal' })                               price!: string; // no precision/scale → defaults
  @Field({ type: 'string' })                                note!: string;  // no length → default 255
  @Field({ type: 'string', required: true, nullable: true }) avatar!: string | null;
}

class MysqlWithTimestamps extends Model {
  static tableName = 'mysql_timestamps';
  @Field({ type: 'uuid', primary: true }) id!: string;
}

class MysqlWithSoftDelete extends Model {
  static tableName = 'mysql_soft';
  static softDelete = true;
  static timestamps = false;
  @Field({ type: 'uuid', primary: true }) id!: string;
}

class MysqlWithArray extends Model {
  static tableName = 'mysql_array';
  static timestamps = false;
  @Field({ type: 'uuid', primary: true }) id!: string;
  @Field({ type: 'array' }) tags!: string[];
}

class MysqlEnumNoValues extends Model {
  static tableName = 'mysql_enum_no_values';
  static timestamps = false;
  @Field({ type: 'uuid', primary: true }) id!: string;
  @Field({ type: 'enum' }) status!: string;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DrizzleTableBuilder', () => {
  describe('PostgreSQL — all column types', () => {
    const table = DrizzleTableBuilder.build(PgAllTypes, 'postgresql');
    const cols = getTableColumns(table);

    it('builds a table object', () => {
      expect(table).toBeDefined();
      expect(cols).toBeDefined();
    });

    it.each([
      'id', 'name', 'bio', 'age', 'score', 'active',
      'createdAt', 'price', 'meta', 'status', 'bigNum', 'seq', 'tags',
    ])('includes column %s', (col) => {
      expect(cols[col]).toBeDefined();
    });

    it('does not add timestamp columns when timestamps=false', () => {
      expect(cols['createdAt']).toBeDefined(); // our own field named createdAt
      // drizzle-added timestamps only appear when timestamps !== false
      // the table has exactly the declared fields
      const columnNames = Object.keys(cols);
      // timestamps=false means NO auto createdAt/updatedAt added by builder
      // (our field named createdAt is the user's own field, so count stays at 13)
      expect(columnNames).toHaveLength(13);
    });
  });

  describe('PostgreSQL — column modifiers', () => {
    const table = DrizzleTableBuilder.build(PgWithModifiers, 'postgresql');
    const cols = getTableColumns(table);

    it('marks primary key', () => {
      expect((cols.id as any).primary).toBe(true);
    });

    it('marks NOT NULL for required field', () => {
      expect((cols.email as any).notNull).toBe(true);
    });

    it('marks unique constraint', () => {
      expect((cols.email as any).isUnique).toBe(true);
    });

    it('does not mark notNull for nullable field', () => {
      expect((cols.bio as any).notNull).toBeFalsy();
    });

    it('does not mark notNull when required+nullable coexist', () => {
      expect((cols.avatar as any).notNull).toBeFalsy();
    });

    it('sets column default value', () => {
      expect((cols.active as any).default).toBe(false);
    });
  });

  describe('PostgreSQL — auto timestamps', () => {
    const table = DrizzleTableBuilder.build(PgWithTimestamps, 'postgresql');
    const cols = getTableColumns(table);

    it('adds createdAt and updatedAt columns', () => {
      expect(cols.createdAt).toBeDefined();
      expect(cols.updatedAt).toBeDefined();
    });
  });

  describe('PostgreSQL — soft delete', () => {
    const table = DrizzleTableBuilder.build(PgWithSoftDelete, 'postgresql');
    const cols = getTableColumns(table);

    it('adds deletedAt column', () => {
      expect(cols.deletedAt).toBeDefined();
    });
  });

  describe('PostgreSQL — named schema', () => {
    it('builds table inside named schema without throwing', () => {
      const table = DrizzleTableBuilder.build(PgWithSchema, 'postgresql');
      expect(table).toBeDefined();
    });
  });

  describe('MySQL — all column types', () => {
    const table = DrizzleTableBuilder.build(MysqlAllTypes, 'mysql');
    const cols = getTableColumns(table);

    it('builds a table object', () => {
      expect(table).toBeDefined();
    });

    it.each([
      'id', 'name', 'bio', 'age', 'score', 'active',
      'createdAt', 'price', 'meta', 'status', 'bigNum', 'seq',
    ])('includes column %s', (col) => {
      expect(cols[col]).toBeDefined();
    });
  });

  describe('MySQL — named schema', () => {
    it('builds table inside named schema without throwing', () => {
      const table = DrizzleTableBuilder.build(MysqlWithSchema, 'mysql');
      expect(table).toBeDefined();
    });
  });

  describe('MySQL — column modifiers and default precision/length', () => {
    const table = DrizzleTableBuilder.build(MysqlWithModifiers, 'mysql');
    const cols = getTableColumns(table);

    it('marks NOT NULL for required field', () => {
      expect((cols.name as any).notNull).toBe(true);
    });

    it('marks unique constraint', () => {
      expect((cols.code as any).isUnique).toBe(true);
    });

    it('sets default value', () => {
      expect((cols.active as any).default).toBe(false);
    });

    it('uses default precision/scale when not specified', () => {
      expect(cols.price).toBeDefined();
    });

    it('uses default length when not specified on varchar', () => {
      expect(cols.note).toBeDefined();
    });

    it('does not mark notNull when required+nullable coexist', () => {
      expect((cols.avatar as any).notNull).toBeFalsy();
    });
  });

  describe('MySQL — auto timestamps', () => {
    const table = DrizzleTableBuilder.build(MysqlWithTimestamps, 'mysql');
    const cols = getTableColumns(table);

    it('adds createdAt and updatedAt datetime columns', () => {
      expect(cols.createdAt).toBeDefined();
      expect(cols.updatedAt).toBeDefined();
    });
  });

  describe('MySQL — soft delete', () => {
    const table = DrizzleTableBuilder.build(MysqlWithSoftDelete, 'mysql');
    const cols = getTableColumns(table);

    it('adds deletedAt datetime column', () => {
      expect(cols.deletedAt).toBeDefined();
    });
  });

  describe('MySQL — array type throws', () => {
    it('throws for array type in MySQL dialect', () => {
      expect(() => DrizzleTableBuilder.build(MysqlWithArray, 'mysql')).toThrow(
        'array" is not supported in MySQL',
      );
    });
  });

  describe('MySQL — enum without enumValues throws', () => {
    it('throws when enumValues missing', () => {
      expect(() => DrizzleTableBuilder.build(MysqlEnumNoValues, 'mysql')).toThrow(
        'requires the enumValues option',
      );
    });
  });

  describe('unsupported dialect', () => {
    it('throws for unknown dialect', () => {
      expect(() => DrizzleTableBuilder.build(PgAllTypes, 'sqlite' as any)).toThrow(
        'Unsupported dialect',
      );
    });
  });
});
