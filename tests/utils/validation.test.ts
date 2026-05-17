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
});