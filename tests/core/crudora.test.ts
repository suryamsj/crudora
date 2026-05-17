import { Crudora } from '../../src/core/crudora';
import { Model } from '../../src/core/model';
import { Field } from '../../src/decorators/model';
import { dbMock, SelectChain } from '../setup';
import express, { Express } from 'express';
import request from 'supertest';

class TestUser extends Model {
  static tableName = 'users';
  static fillable = ['name', 'email'];

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true })
  name!: string;

  @Field({ type: 'string', required: true })
  email!: string;
}

class TestProduct extends Model {
  static tableName = 'products';
  static fillable = ['title', 'price'];

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string' })
  title!: string;
}

describe('Crudora', () => {
  let crudora: Crudora;
  let app: Express;

  beforeEach(() => {
    crudora = new Crudora(dbMock, 'postgresql');
    app = express();
    app.use(express.json());
  });

  describe('constructor', () => {
    it('should throw error when no db provided', () => {
      expect(() => new Crudora(null, 'postgresql')).toThrow(
        'Crudora: db is required.',
      );
    });

    it('should create instance with a db client', () => {
      expect(crudora).toBeInstanceOf(Crudora);
    });
  });

  describe('registerModel', () => {
    it('should register a single model', () => {
      const result = crudora.registerModel(TestUser);

      expect(result).toBe(crudora);
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
      const repo = crudora.getRepository(TestUser);

      expect(repo).toBeDefined();
    });

    it('should throw error for unregistered model', () => {
      expect(() => crudora.getRepository(TestUser)).toThrow(
        'Repository for TestUser not found. Did you register the model?',
      );
    });
  });

  describe('validation schemas', () => {
    beforeEach(() => {
      crudora.registerModel(TestUser);
    });

    it('should generate partial validation schema', () => {
      const schema = crudora.getValidationSchema(TestUser);

      expect(schema).toBeDefined();
      expect(() => schema.parse({ name: 'John' })).not.toThrow();
      expect(() => schema.parse({})).not.toThrow();
    });

    it('should generate strict validation schema', () => {
      const schema = crudora.getStrictValidationSchema(TestUser);

      expect(schema).toBeDefined();
      expect(() => schema.parse({ name: 'John', email: 'john@example.com' })).not.toThrow();
    });
  });

  describe('custom routes', () => {
    it('should add GET route and return this', () => {
      expect(crudora.get('/test', jest.fn())).toBe(crudora);
    });

    it('should add POST route and return this', () => {
      expect(crudora.post('/test', jest.fn())).toBe(crudora);
    });

    it('should add PUT route and return this', () => {
      expect(crudora.put('/test', jest.fn())).toBe(crudora);
    });

    it('should add DELETE route and return this', () => {
      expect(crudora.delete('/test', jest.fn())).toBe(crudora);
    });

    it('should add PATCH route and return this', () => {
      expect(crudora.patch('/test', jest.fn())).toBe(crudora);
    });
  });

  describe('generateRoutes', () => {
    beforeEach(() => {
      crudora.registerModel(TestUser);
      dbMock.select.mockImplementation(() => new SelectChain([]));
    });

    it('should generate API documentation endpoint', async () => {
      crudora.generateRoutes(app);

      const response = await request(app).get('/api');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.routes).toBeDefined();
      expect(response.body.data.routes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ method: 'GET', path: '/api/users', type: 'CRUD' }),
        ]),
      );
    });

    it('should generate CRUD routes for registered models', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ count: 0 }]));
      crudora.generateRoutes(app);

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.meta.pagination).toBeDefined();
    });

    it('should include custom routes in documentation', async () => {
      crudora.get('/custom', (_req, res) => res.json({ custom: true }));
      crudora.generateRoutes(app);

      const response = await request(app).get('/api');

      expect(response.body.data.routes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ method: 'GET', path: '/api/custom', type: 'Custom' }),
        ]),
      );
    });
  });
});
