import { Crudora } from '../../src/core/crudora';
import { Model } from '../../src/core/model';
import { prismaMock } from '../setup';
import express, { Express } from 'express';
import request from 'supertest';

class TestUser extends Model {
  static tableName = 'users';
  static fillable = ['name', 'email'];

  id?: string;
  name?: string;
  email?: string;
}

class TestProduct extends Model {
  static tableName = 'products';
  static fillable = ['title', 'price'];

  id?: string;
  title?: string;
  price?: number;
}

describe('Crudora', () => {
  let crudora: Crudora;
  let app: Express;

  beforeEach(() => {
    crudora = new Crudora(prismaMock);
    app = express();
    app.use(express.json());
  });

  describe('constructor', () => {
    it('should throw error when no Prisma client provided', () => {
      expect(() => new Crudora()).toThrow('PrismaClient is required. Please provide a PrismaClient instance.');
    });

    it('should create instance with Prisma client', () => {
      expect(crudora).toBeInstanceOf(Crudora);
    });
  });

  describe('registerModel', () => {
    it('should register a single model', () => {
      const result = crudora.registerModel(TestUser);

      expect(result).toBe(crudora); // Should return this for chaining
      expect(() => crudora.getRepository(TestUser)).not.toThrow();
    });

    it('should register multiple models', () => {
      const result = crudora.registerModel(TestUser, TestProduct);

      expect(result).toBe(crudora);
      expect(() => crudora.getRepository(TestUser)).not.toThrow();
      expect(() => crudora.getRepository(TestProduct)).not.toThrow();
    });
  });

  describe('getRepository', () => {
    it('should return repository for registered model', () => {
      crudora.registerModel(TestUser);
      const repository = crudora.getRepository(TestUser);

      expect(repository).toBeDefined();
    });

    it('should throw error for unregistered model', () => {
      expect(() => crudora.getRepository(TestUser))
        .toThrow('Repository for TestUser not found. Did you register the model?');
    });
  });

  describe('validation schemas', () => {
    beforeEach(() => {
      crudora.registerModel(TestUser);
    });

    it('should generate partial validation schema', () => {
      const schema = crudora.getValidationSchema(TestUser);

      expect(schema).toBeDefined();

      // Test valid partial data
      const validData = { name: 'John' };
      expect(() => schema.parse(validData)).not.toThrow();

      // Test empty data
      expect(() => schema.parse({})).not.toThrow();
    });

    it('should generate strict validation schema', () => {
      const schema = crudora.getStrictValidationSchema(TestUser);

      expect(schema).toBeDefined();

      // Test valid complete data
      const validData = { name: 'John', email: 'john@example.com' };
      expect(() => schema.parse(validData)).not.toThrow();
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

  describe('generateRoutes', () => {
    beforeEach(() => {
      crudora.registerModel(TestUser);
      prismaMock.users.findMany.mockResolvedValue([]);
      prismaMock.users.count.mockResolvedValue(0);
    });

    it('should generate API documentation endpoint', async () => {
      crudora.generateRoutes(app);

      const response = await request(app).get('/api');

      expect(response.status).toBe(200);
      expect(response.body.routes).toBeDefined();
      expect(response.body.routes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'GET',
            path: '/api/users',
            type: 'CRUD'
          })
        ])
      );
    });

    it('should generate CRUD routes for registered models', async () => {
      crudora.generateRoutes(app);

      // Test GET /api/users
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
    });

    it('should include custom routes in documentation', async () => {
      crudora.get('/custom', (req, res) => res.json({ custom: true }));
      crudora.generateRoutes(app);

      const response = await request(app).get('/api');

      expect(response.body.routes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'GET',
            path: '/api/custom',
            type: 'Custom'
          })
        ])
      );
    });
  });
});
