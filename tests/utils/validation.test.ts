import { ValidationGenerator } from '../../src/utils/validation';
import { Model } from '../../src/core/model';
import { z } from 'zod';

class TestUser extends Model {
  static fillable = ['name', 'email', 'age'];
  
  id?: string;
  name?: string;
  email?: string;
  age?: number;
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
    it('should generate strict schema for model with fillable fields', () => {
      const schema = ValidationGenerator.generateStrictZodSchema(TestUser);
      
      // Test valid complete data
      expect(() => schema.parse({
        name: 'John',
        email: 'john@example.com',
        age: '25'
      })).not.toThrow();
      
      // Test incomplete data should throw
      expect(() => schema.parse({ name: 'John' })).toThrow();
      expect(() => schema.parse({})).toThrow();
    });

    it('should return empty schema for model without fillable fields', () => {
      const schema = ValidationGenerator.generateStrictZodSchema(EmptyModel);
      
      expect(() => schema.parse({})).not.toThrow();
    });
  });
});