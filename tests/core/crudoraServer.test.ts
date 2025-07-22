import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { CrudoraServer } from '../../src/core/crudoraServer';
import { Model } from '../../src/core/model';
import { Field } from '../../src/decorators/model';

class TestUser extends Model {
  static tableName = 'testuser'; // Fix: Use 'testuser' to match expected route

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true })
  name!: string;

  @Field({ type: 'string', required: true })
  email!: string;
}

describe('CrudoraServer', () => {
  let prisma: jest.Mocked<PrismaClient>;
  let server: CrudoraServer;
  let mockUserModel: any;

  beforeEach(() => {
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockUserModel = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };
    (prisma as any).testuser = mockUserModel; // Fix: Change to 'testuser'

    server = new CrudoraServer({ prisma, port: 3001 });
  });

  describe('constructor', () => {
    it('should create server with default config', () => {
      const defaultServer = new CrudoraServer({ prisma });
      expect(defaultServer).toBeInstanceOf(CrudoraServer);
    });

    it('should create server with custom config', () => {
      const customServer = new CrudoraServer({
        prisma,
        port: 4000,
        cors: false,
        bodyParser: false,
        basePath: '/v1'
      });
      expect(customServer).toBeInstanceOf(CrudoraServer);
    });
  });

  describe('registerModel', () => {
    it('should register model and return server instance', () => {
      const result = server.registerModel(TestUser);
      expect(result).toBe(server);
    });
  });

  describe('generateRoutes', () => {
    it('should generate routes and return server instance', () => {
      server.registerModel(TestUser);
      const result = server.generateRoutes();
      expect(result).toBe(server);
    });
  });

  describe('middleware methods', () => {
    it('should add middleware', () => {
      const middleware = jest.fn((req: any, res: any, next: any) => next());
      const result = server.use(middleware);
      expect(result).toBe(server);
    });
  });

  describe('custom route methods', () => {
    it('should add GET route', () => {
      const handler = jest.fn();
      const result = server.get('/test', handler);
      expect(result).toBe(server);
    });

    it('should add POST route', () => {
      const handler = jest.fn();
      const result = server.post('/test', handler);
      expect(result).toBe(server);
    });
  });

  describe('API endpoints', () => {
    beforeEach(() => {
      server.registerModel(TestUser).generateRoutes();
    });

    it('should handle GET /api/testuser', async () => {
      const mockUsers = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Doe', email: 'jane@example.com' }
      ];
      mockUserModel.findMany.mockResolvedValue(mockUsers);
      mockUserModel.count.mockResolvedValue(2);

      const response = await request(server.getApp())
        .get('/api/testuser')
        .expect(200);

      expect(response.body.data).toEqual(mockUsers);
      expect(response.body.pagination).toBeDefined();
    });

    it('should handle GET /api/testuser/:id', async () => {
      const mockUser = { id: '1', name: 'John Doe', email: 'john@example.com' };
      mockUserModel.findUnique.mockResolvedValue(mockUser);

      const response = await request(server.getApp())
        .get('/api/testuser/1')
        .expect(200);

      expect(response.body).toEqual(mockUser);
    });

    it('should handle POST /api/testuser', async () => {
      const userData = { name: 'John Doe', email: 'john@example.com' };
      const mockUser = { id: '1', ...userData };
      mockUserModel.create.mockResolvedValue(mockUser);

      const response = await request(server.getApp())
        .post('/api/testuser')
        .send(userData)
        .expect(201);

      expect(response.body).toEqual(mockUser);
    });

    it('should handle 404 for non-existent user', async () => {
      mockUserModel.findUnique.mockResolvedValue(null);

      await request(server.getApp())
        .get('/api/testuser/999')
        .expect(404);
    });
  });

  describe('getApp', () => {
    it('should return express app instance', () => {
      const app = server.getApp();
      expect(app).toBeDefined();
    });
  });

  describe('getCrudora', () => {
    it('should return crudora instance', () => {
      const crudora = server.getCrudora();
      expect(crudora).toBeDefined();
    });
  });
});
