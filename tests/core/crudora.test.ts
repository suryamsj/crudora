import { PrismaClient } from '@prisma/client';
import { Crudora } from '../../src/core/crudora';
import { Model } from '../../src/core/model';

class TestUser extends Model {
  static tableName = 'users';
  id!: string;
  name!: string;
  email!: string;
}

class TestPost extends Model {
  static tableName = 'posts';
  id!: string;
  title!: string;
  content!: string;
}

describe('Crudora', () => {
  let prisma: jest.Mocked<PrismaClient>;
  let crudora: Crudora;

  beforeEach(() => {
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    crudora = new Crudora(prisma);
  });

  describe('constructor', () => {
    it('should create instance with prisma client', () => {
      expect(crudora).toBeInstanceOf(Crudora);
    });

    it('should throw error when no prisma client provided', () => {
      expect(() => new Crudora()).toThrow('PrismaClient is required');
    });
  });

  describe('registerModel', () => {
    it('should register single model', () => {
      const result = crudora.registerModel(TestUser);

      expect(result).toBe(crudora); // Should return this for chaining
      expect(() => crudora.getRepository(TestUser)).not.toThrow();
    });

    it('should register multiple models', () => {
      const result = crudora.registerModel(TestUser, TestPost);

      expect(result).toBe(crudora);
      expect(() => crudora.getRepository(TestUser)).not.toThrow();
      expect(() => crudora.getRepository(TestPost)).not.toThrow();
    });
  });

  describe('getRepository', () => {
    beforeEach(() => {
      crudora.registerModel(TestUser);
    });

    it('should return repository for registered model', () => {
      const repository = crudora.getRepository(TestUser);
      expect(repository).toBeDefined();
    });

    it('should throw error for unregistered model', () => {
      expect(() => crudora.getRepository(TestPost)).toThrow(
        'Repository for TestPost not found. Did you register the model?'
      );
    });
  });

  describe('custom routes', () => {
    it('should add GET route', () => {
      const handler = jest.fn();
      const result = crudora.get('/test', handler);

      expect(result).toBe(crudora);
    });

    it('should add POST route', () => {
      const handler = jest.fn();
      const result = crudora.post('/test', handler);

      expect(result).toBe(crudora);
    });

    it('should add PUT route', () => {
      const handler = jest.fn();
      const result = crudora.put('/test', handler);

      expect(result).toBe(crudora);
    });

    it('should add DELETE route', () => {
      const handler = jest.fn();
      const result = crudora.delete('/test', handler);

      expect(result).toBe(crudora);
    });

    it('should add PATCH route', () => {
      const handler = jest.fn();
      const result = crudora.patch('/test', handler);

      expect(result).toBe(crudora);
    });
  });

  describe('generatePrismaSchema', () => {
    beforeEach(() => {
      crudora.registerModel(TestUser, TestPost);
    });

    it('should generate prisma schema', () => {
      const schema = crudora.generatePrismaSchema();
      expect(typeof schema).toBe('string');
      expect(schema.length).toBeGreaterThan(0);
    });

    it('should generate prisma schema with custom provider', () => {
      const schema = crudora.generatePrismaSchema('postgresql');
      expect(typeof schema).toBe('string');
      expect(schema).toContain('postgresql');
    });
  });

  describe('getValidationSchema', () => {
    beforeEach(() => {
      crudora.registerModel(TestUser);
    });

    it('should return validation schema for model', () => {
      const schema = crudora.getValidationSchema(TestUser);
      expect(schema).toBeDefined();
    });
  });
});
