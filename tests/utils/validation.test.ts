import { ValidationGenerator } from '../../src/utils/validation';
import { Model } from '../../src/core/model';
import { Field } from '../../src/decorators/model';
import { z } from 'zod';

class TestUser extends Model {
  static fillable = ['name', 'email', 'age'];

  id?: string;
  name?: string;
  email?: string;
  age?: number;
}

class FieldModel extends Model {
  static tableName = 'field_models';

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true, length: 50 })
  username!: string;

  @Field({ type: 'string', nullable: true })
  bio!: string | null;

  @Field({ type: 'string', required: true, nullable: true })
  avatar!: string | null;
}

class NewTypesModel extends Model {
  static tableName = 'new_types';

  @Field({ type: 'serial', primary: true })
  id!: number;

  @Field({ type: 'enum', enumValues: ['active', 'inactive', 'pending'] })
  status!: string;

  @Field({ type: 'bigint' })
  largeNumber!: number;

  @Field({ type: 'array' })
  tags!: string[];
}

class AllTypesModel extends Model {
  static tableName = 'all_types';
  static timestamps = false;

  @Field({ type: 'uuid', primary: true })               id!: string;
  @Field({ type: 'text' })                              bio!: string;
  @Field({ type: 'integer' })                           age!: number;
  @Field({ type: 'number' })                            score!: number;
  @Field({ type: 'boolean' })                           active!: boolean;
  @Field({ type: 'date' })                              birthday!: Date;
  @Field({ type: 'decimal', precision: 5, scale: 2 })   price!: string;
  @Field({ type: 'json' })                              meta!: object;
  @Field({ type: 'uuid' })                              ownerId!: string;
  @Field({ type: 'serial' })                            seq!: number;
  @Field({ type: 'enum' })                              raw!: string;
}

class EmptyModel extends Model {
  static fillable: string[] = [];
  
  id?: string;
}

class NoFillableModel extends Model {
  id?: string;
  name?: string;
}

describe('ValidationGenerator', () => {
  describe('generateZodSchema', () => {
    it('should generate partial schema for model with fillable fields', () => {
      const schema = ValidationGenerator.generateZodSchema(TestUser);
      
      // Test valid partial data
      expect(() => schema.parse({ name: 'John' })).not.toThrow();
      expect(() => schema.parse({ email: 'john@example.com' })).not.toThrow();
      expect(() => schema.parse({ age: '25' })).not.toThrow();
      expect(() => schema.parse({})).not.toThrow();
      
      // Test complete data
      expect(() => schema.parse({
        name: 'John',
        email: 'john@example.com',
        age: '25'
      })).not.toThrow();
    });

    it('should return empty partial schema for model without fillable fields', () => {
      const schema = ValidationGenerator.generateZodSchema(EmptyModel);
      
      expect(() => schema.parse({})).not.toThrow();
    });

    it('should return empty partial schema for model with undefined fillable', () => {
      const schema = ValidationGenerator.generateZodSchema(NoFillableModel);
      
      expect(() => schema.parse({})).not.toThrow();
    });
  });

  describe('generateStrictZodSchema', () => {
    it('should generate permissive schema for fillable-only model (no @Field decorators)', () => {
      // Without @Field() metadata, column types are unknown — all fields become optional strings
      // so the DB can enforce constraints rather than the API layer guessing required status.
      const schema = ValidationGenerator.generateStrictZodSchema(TestUser);

      expect(() => schema.parse({ name: 'John', email: 'john@example.com', age: '25' })).not.toThrow();
      expect(() => schema.parse({ name: 'John' })).not.toThrow();
      expect(() => schema.parse({})).not.toThrow();
    });

    it('should return empty schema for model without fillable fields', () => {
      const schema = ValidationGenerator.generateStrictZodSchema(EmptyModel);

      expect(() => schema.parse({})).not.toThrow();
    });
  });

  describe('string length validation', () => {
    it('should reject strings exceeding the declared length', () => {
      const schema = ValidationGenerator.generateZodSchema(FieldModel);

      expect(() => schema.parse({ username: 'a'.repeat(51) })).toThrow();
      expect(() => schema.parse({ username: 'a'.repeat(50) })).not.toThrow();
    });
  });

  describe('nullable field validation', () => {
    it('should allow null for nullable fields in partial schema', () => {
      const schema = ValidationGenerator.generateZodSchema(FieldModel);

      expect(() => schema.parse({ bio: null })).not.toThrow();
      expect(() => schema.parse({ avatar: null })).not.toThrow();
    });

    it('should allow null for nullable fields in strict schema', () => {
      const schema = ValidationGenerator.generateStrictZodSchema(FieldModel);

      expect(() => schema.parse({ username: 'john', avatar: null })).not.toThrow();
    });

    it('should reject null for non-nullable required fields', () => {
      const strictSchema = ValidationGenerator.generateStrictZodSchema(FieldModel);

      expect(() => strictSchema.parse({ username: null, avatar: 'url' })).toThrow();
    });
  });

  describe('new field types', () => {
    it('should validate enum values', () => {
      const schema = ValidationGenerator.generateZodSchema(NewTypesModel);

      expect(() => schema.parse({ status: 'active' })).not.toThrow();
      expect(() => schema.parse({ status: 'pending' })).not.toThrow();
      expect(() => schema.parse({ status: 'deleted' })).toThrow();
    });

    it('should validate bigint as integer', () => {
      const schema = ValidationGenerator.generateZodSchema(NewTypesModel);

      expect(() => schema.parse({ largeNumber: 9999999 })).not.toThrow();
      expect(() => schema.parse({ largeNumber: 1.5 })).toThrow();
      expect(() => schema.parse({ largeNumber: 'not-a-number' })).toThrow();
    });

    it('should validate array as string array', () => {
      const schema = ValidationGenerator.generateZodSchema(NewTypesModel);

      expect(() => schema.parse({ tags: ['typescript', 'drizzle'] })).not.toThrow();
      expect(() => schema.parse({ tags: 'not-an-array' })).toThrow();
    });
  });

  describe('all field types coverage', () => {
    const schema = ValidationGenerator.generateZodSchema(AllTypesModel);
    const strict  = ValidationGenerator.generateStrictZodSchema(AllTypesModel);

    it('accepts valid values for every field type', () => {
      expect(() => schema.parse({
        bio:      'some text',
        age:      25,
        score:    9.5,
        active:   true,
        birthday: new Date().toISOString(),
        price:    '9.99',
        meta:     { key: 'value' },
        ownerId:  '550e8400-e29b-41d4-a716-446655440000',
        seq:      1,
        raw:      'anything',
      })).not.toThrow();
    });

    it('rejects float for integer field', () => {
      expect(() => schema.parse({ age: 1.5 })).toThrow();
    });

    it('rejects invalid decimal string', () => {
      expect(() => schema.parse({ price: 'not-decimal' })).toThrow();
    });

    it('accepts json object or array', () => {
      expect(() => schema.parse({ meta: { a: 1 } })).not.toThrow();
      expect(() => schema.parse({ meta: [1, 2, 3] })).not.toThrow();
    });

    it('rejects non-boolean for boolean field', () => {
      expect(() => schema.parse({ active: 'yes' })).toThrow();
    });

    it('rejects non-integer for serial field', () => {
      expect(() => strict.parse({ seq: 1.5 })).toThrow();
    });

    it('rejects non-positive for serial field', () => {
      expect(() => strict.parse({ seq: 0 })).toThrow();
    });

    it('validates enum-without-enumValues as any string', () => {
      expect(() => schema.parse({ raw: 'anything' })).not.toThrow();
    });
  });
});