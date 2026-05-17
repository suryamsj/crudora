import { Crudora } from '../../src/core/crudora';
import { Model } from '../../src/core/model';
import { Field } from '../../src/decorators/model';
import { dbMock, SelectChain, insertValuesMock, updateWhereMock, deleteWhereMock } from '../setup';
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

    it('serves custom PUT, PATCH, and DELETE routes', async () => {
      crudora.put('/item', (_req, res) => res.json({ method: 'PUT' }));
      crudora.patch('/item', (_req, res) => res.json({ method: 'PATCH' }));
      crudora.delete('/item', (_req, res) => res.status(204).send());
      crudora.generateRoutes(app);

      const [putRes, patchRes, delRes] = await Promise.all([
        request(app).put('/api/item'),
        request(app).patch('/api/item'),
        request(app).delete('/api/item'),
      ]);

      expect(putRes.body.method).toBe('PUT');
      expect(patchRes.body.method).toBe('PATCH');
      expect(delRes.status).toBe(204);
    });
  });

  describe('invalid db', () => {
    it('throws when db is missing select/insert methods', () => {
      expect(() => new Crudora({} as any, 'postgresql')).toThrow(
        'does not look like a Drizzle ORM instance',
      );
    });
  });

  describe('registerTable', () => {
    it('registers a model with a pre-built table', () => {
      const fakeTable = { _: { name: 'users' } } as any;
      crudora.registerTable(TestUser, fakeTable);
      expect(crudora.getTable(TestUser)).toBe(fakeTable);
    });
  });

  describe('getTable', () => {
    it('returns the Drizzle table for a registered model', () => {
      crudora.registerModel(TestUser);
      expect(crudora.getTable(TestUser)).toBeDefined();
    });

    it('throws for an unregistered model', () => {
      expect(() => crudora.getTable(TestUser)).toThrow(
        'Table for TestUser not found. Did you register the model?',
      );
    });
  });

  describe('generateDrizzleSchema', () => {
    it('returns a schema string for all registered models', () => {
      crudora.registerModel(TestUser, TestProduct);
      const schema = crudora.generateDrizzleSchema();
      expect(schema).toContain("from 'drizzle-orm/pg-core'");
      expect(schema).toContain('users');
      expect(schema).toContain('products');
    });
  });

  describe('transaction', () => {
    it('delegates to db.transaction', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      dbMock.transaction = jest.fn().mockImplementation((cb: any) => cb(dbMock));
      await crudora.transaction(fn);
      expect(fn).toHaveBeenCalledWith(dbMock);
    });
  });

  describe('route error handling', () => {
    beforeEach(() => {
      crudora.registerModel(TestUser);
    });

    it('GET /resource — returns 500 when repository throws', async () => {
      dbMock.select.mockImplementation(() => { throw new Error('DB down'); });
      crudora.generateRoutes(app);
      const response = await request(app).get('/api/users');
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('GET /resource/:id — returns 404 when item not found', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([]));
      crudora.generateRoutes(app);
      const response = await request(app).get('/api/users/nonexistent-id');
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('GET /resource/:id — returns 500 when repository throws', async () => {
      dbMock.select.mockImplementation(() => { throw new Error('DB error'); });
      crudora.generateRoutes(app);
      const response = await request(app).get('/api/users/some-id');
      expect(response.status).toBe(500);
    });

    it('POST /resource — returns 422 when required fields are missing', async () => {
      crudora.generateRoutes(app);
      const response = await request(app).post('/api/users').send({});
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });

    it('PUT /resource/:id — returns 404 when item not found', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([]));
      crudora.generateRoutes(app);
      const response = await request(app)
        .put('/api/users/ghost-id')
        .send({ name: 'Test', email: 'test@example.com' });
      expect(response.status).toBe(404);
    });

    it('PUT /resource/:id — returns 422 for invalid body', async () => {
      crudora.generateRoutes(app);
      const response = await request(app)
        .put('/api/users/some-id')
        .send({});
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('PATCH /resource/:id — returns 404 when item not found', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([]));
      crudora.generateRoutes(app);
      const response = await request(app)
        .patch('/api/users/ghost-id')
        .send({ name: 'Updated' });
      expect(response.status).toBe(404);
    });

    it('PATCH /resource/:id — returns 422 when body fails partial schema', async () => {
      crudora.generateRoutes(app);
      const response = await request(app)
        .patch('/api/users/some-id')
        .send({ name: 123 }); // number, not string
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('DELETE /resource/:id — returns 404 when item not found', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([]));
      crudora.generateRoutes(app);
      const response = await request(app).delete('/api/users/ghost-id');
      expect(response.status).toBe(404);
    });

    it('GET /resource — accepts select and with query params', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ count: '0' }]));
      crudora.generateRoutes(app);
      const response = await request(app).get('/api/users?select=name,email&with=posts');
      expect(response.status).toBe(200);
    });

    it('GET /resource — sanitizes custom filter params', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ count: '0' }]));
      crudora.generateRoutes(app);
      const response = await request(app).get('/api/users?name=John');
      expect(response.status).toBe(200);
    });

    it('GET /resource/:id — accepts select and with query params', async () => {
      const user = { id: 'some-id', name: 'Test', email: 'test@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([user]));
      crudora.generateRoutes(app);
      const response = await request(app).get('/api/users/some-id?select=name&with=posts');
      expect(response.status).toBe(200);
    });

    it('POST /resource — returns 500 when repository.create throws non-ZodError', async () => {
      insertValuesMock.mockRejectedValue(new Error('DB connection lost'));
      crudora.generateRoutes(app);
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'Test', email: 'test@example.com' });
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('PUT /resource/:id — returns 500 when repository.update throws non-NotFoundError', async () => {
      const user = { id: 'some-id', name: 'Old', email: 'old@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([user]));
      updateWhereMock.mockRejectedValue(new Error('DB error'));
      crudora.generateRoutes(app);
      const response = await request(app)
        .put('/api/users/some-id')
        .send({ name: 'New', email: 'new@example.com' });
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('PATCH /resource/:id — returns 500 when repository.update throws non-NotFoundError', async () => {
      const user = { id: 'some-id', name: 'Old', email: 'old@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([user]));
      updateWhereMock.mockRejectedValue(new Error('DB error'));
      crudora.generateRoutes(app);
      const response = await request(app)
        .patch('/api/users/some-id')
        .send({ name: 'Updated' });
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('DELETE /resource/:id — returns 500 when repository.delete throws non-NotFoundError', async () => {
      const user = { id: 'some-id', name: 'Test', email: 'test@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([user]));
      deleteWhereMock.mockRejectedValue(new Error('DB error'));
      crudora.generateRoutes(app);
      const response = await request(app).delete('/api/users/some-id');
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('cursor-based pagination', () => {
    beforeEach(() => {
      crudora.registerModel(TestUser);
      dbMock.select.mockImplementation(() => new SelectChain([]));
    });

    it('switches to cursor mode when cursor param is present', async () => {
      crudora.generateRoutes(app);
      const response = await request(app).get('/api/users?cursor=');
      expect(response.status).toBe(200);
      expect(response.body.meta).toHaveProperty('cursor');
      expect(response.body.meta.cursor).toHaveProperty('next');
      expect(response.body.meta.cursor).toHaveProperty('hasMore');
    });

    it('passes cursor value and order to findWithCursor', async () => {
      crudora.generateRoutes(app);
      const response = await request(app).get('/api/users?cursor=abc123&order=desc&limit=5');
      expect(response.status).toBe(200);
      expect(response.body.meta.cursor).toBeDefined();
    });
  });
});
