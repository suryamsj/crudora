import { z } from 'zod';
import { ValidationGenerator } from '../../src/utils/validation';
import { Field } from '../../src/decorators/model';

class TestValidationModel {
  @Field({ type: 'string', required: true })
  name!: string;

  @Field({ type: 'string', required: true, length: 100 })
  email!: string;

  @Field({ type: 'number', required: false })
  age?: number;

  @Field({ type: 'boolean', required: false })
  isActive?: boolean;

  @Field({ type: 'date', required: true })
  createdAt!: Date;

  @Field({ type: 'uuid', required: true })
  id!: string;
}

describe('ValidationGenerator', () => {
  describe('generateZodSchema (partial)', () => {
    let schema: z.ZodType<Partial<TestValidationModel>>;

    beforeEach(() => {
      schema = ValidationGenerator.generateZodSchema(TestValidationModel);
    });

    it('should generate valid schema for complete valid data', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        createdAt: new Date(),
        id: '123e4567-e89b-12d3-a456-426614174000'
      };

      expect(() => schema.parse(validData)).not.toThrow();
    });

    it('should allow partial data (since schema is partial)', () => {
      const partialData = { name: 'John Doe' };
      expect(() => schema.parse(partialData)).not.toThrow();
    });

    it('should validate string fields when provided', () => {
      const validData = { name: 'John Doe' };
      const invalidData = { name: 123 };

      expect(() => schema.parse(validData)).not.toThrow();
      expect(() => schema.parse(invalidData)).toThrow();
    });

    it('should validate string length constraints when provided', () => {
      const validData = { email: 'a'.repeat(50) };
      const invalidData = { email: 'a'.repeat(150) };

      expect(() => schema.parse(validData)).not.toThrow();
      expect(() => schema.parse(invalidData)).toThrow();
    });

    it('should validate number fields when provided', () => {
      const validData = { age: 30 };
      const invalidData = { age: 'thirty' };

      expect(() => schema.parse(validData)).not.toThrow();
      expect(() => schema.parse(invalidData)).toThrow();
    });

    it('should validate boolean fields when provided', () => {
      const validData = { isActive: true };
      const invalidData = { isActive: 'yes' };

      expect(() => schema.parse(validData)).not.toThrow();
      expect(() => schema.parse(invalidData)).toThrow();
    });

    it('should validate date fields when provided', () => {
      const validData = { createdAt: new Date() };
      const invalidData = { createdAt: '2023-01-01' };

      expect(() => schema.parse(validData)).not.toThrow();
      expect(() => schema.parse(invalidData)).toThrow();
    });

    it('should validate UUID fields when provided', () => {
      const validData = { id: '123e4567-e89b-12d3-a456-426614174000' };
      const invalidData = { id: 'invalid-uuid' };

      expect(() => schema.parse(validData)).not.toThrow();
      expect(() => schema.parse(invalidData)).toThrow();
    });

    it('should handle optional fields correctly', () => {
      const dataWithoutOptional = { name: 'John' };
      const dataWithOptional = { name: 'John', age: 30, isActive: true };

      expect(() => schema.parse(dataWithoutOptional)).not.toThrow();
      expect(() => schema.parse(dataWithOptional)).not.toThrow();
    });

    it('should allow empty object (since all fields are optional in partial schema)', () => {
      expect(() => schema.parse({})).not.toThrow();
    });
  });

  describe('generateStrictZodSchema (strict)', () => {
    let strictSchema: z.ZodType<TestValidationModel>;

    beforeEach(() => {
      strictSchema = ValidationGenerator.generateStrictZodSchema(TestValidationModel);
    });

    it('should require all required fields in strict mode', () => {
      const completeData = {
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date(),
        id: '123e4567-e89b-12d3-a456-426614174000'
      };

      const incompleteData = {
        name: 'John Doe'
        // Missing required fields: email, createdAt, id
      };

      expect(() => strictSchema.parse(completeData)).not.toThrow();
      expect(() => strictSchema.parse(incompleteData)).toThrow();
    });

    it('should allow optional fields to be omitted in strict mode', () => {
      const dataWithoutOptional = {
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date(),
        id: '123e4567-e89b-12d3-a456-426614174000'
      };

      expect(() => strictSchema.parse(dataWithoutOptional)).not.toThrow();
    });
  });
});
