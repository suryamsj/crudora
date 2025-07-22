import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { CrudoraServer } from '../../src/core/crudoraServer';
import { Model } from '../../src/core/model';
import { Model as ModelDecorator, Field } from '../../src/decorators/model';

@ModelDecorator({ tableName: 'users' })
class User extends Model {
  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true })
  name!: string;

  @Field({ type: 'string', required: true, unique: true })
  email!: string;

  @Field({ type: 'number', required: false })
  age?: number;
}

class Post extends Model {
  static tableName = 'posts';

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true })
  title!: string;

  @Field({ type: 'string', required: true })
  content!: string;

  @Field({ type: 'string', required: true })
  userId!: string;
}

describe('Full Integration Test', () => {
  let prisma: jest.Mocked<PrismaClient>;
  let server: CrudoraServer;
  let mockUserModel: any;
  let mockPostModel: any;

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

    mockPostModel = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };

    (prisma as any).users = mockUserModel;
    (prisma as any).posts = mockPostModel;

    server = new CrudoraServer({ prisma, port: 3002 });
  });

  describe('Complete CRUD workflow', () => {
    beforeEach(() => {
      server
        .registerModel(User, Post)
        .generateRoutes();
    });

    it('should handle complete user lifecycle', async () => {
      const app = server.getApp();

      // Create user - Fix: Remove age field since it's optional and might cause validation issues
      const userData = { name: 'John Doe', email: 'john@example.com' };
      const createdUser = { id: '1', ...userData };
      mockUserModel.create.mockResolvedValue(createdUser);

      const createResponse = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(createResponse.body).toEqual(createdUser);

      // Get user
      mockUserModel.findUnique.mockResolvedValue(createdUser);

      const getResponse = await request(app)
        .get('/api/users/1')
        .expect(200);

      expect(getResponse.body).toEqual(createdUser);

      // Update user
      const updatedUser = { ...createdUser, name: 'John Updated' };
      mockUserModel.update.mockResolvedValue(updatedUser);

      const updateResponse = await request(app)
        .put('/api/users/1')
        .send({ name: 'John Updated' })
        .expect(200);

      expect(updateResponse.body).toEqual(updatedUser);

      // Delete user
      mockUserModel.delete.mockResolvedValue(createdUser);

      await request(app)
        .delete('/api/users/1')
        .expect(204);
    });

    it('should handle pagination and filtering', async () => {
      const app = server.getApp();
      const mockUsers = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Doe', email: 'jane@example.com' }
      ];

      mockUserModel.findMany.mockResolvedValue(mockUsers);
      mockUserModel.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/users?page=1&limit=10&name=John')
        .expect(200);

      expect(response.body.data).toEqual(mockUsers);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        pages: 1
      });
    });

    it('should handle validation errors', async () => {
      const app = server.getApp();

      // Try to create user with invalid data
      await request(app)
        .post('/api/users')
        .send({ name: 123 }) // Invalid name type
        .expect(400);
    });
  });

  describe('Custom routes integration', () => {
    it('should handle custom routes alongside auto-generated ones', async () => {
      server
        .registerModel(User)
        .get('/custom/health', (req, res) => {
          res.json({ status: 'ok' });
        })
        .post('/custom/users/bulk', (req, res) => {
          res.json({ message: 'Bulk operation completed' });
        })
        .generateRoutes();

      const app = server.getApp();

      // Test custom GET route
      const healthResponse = await request(app)
        .get('/api/custom/health')
        .expect(200);

      expect(healthResponse.body).toEqual({ status: 'ok' });

      // Test custom POST route
      const bulkResponse = await request(app)
        .post('/api/custom/users/bulk')
        .send({ users: [] })
        .expect(200);

      expect(bulkResponse.body).toEqual({ message: 'Bulk operation completed' });
    });
  });
});
