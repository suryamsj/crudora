import { CrudoraServer } from '../../src/core/crudoraServer';
import { Model } from '../../src/core/model';
import { Field } from '../../src/decorators/model';
import { dbMock, insertValuesMock, SelectChain } from '../setup';
import request from 'supertest';

class User extends Model {
  static tableName = 'users';
  static fillable = ['name', 'email'];
  static hidden = ['password'];

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true })
  name!: string;

  @Field({ type: 'string', required: true, unique: true })
  email!: string;

  @Field({ type: 'string', required: true })
  password!: string;
}

describe('CRUD Operations Integration', () => {
  let server: CrudoraServer;
  let app: any;

  beforeEach(() => {
    server = new CrudoraServer({ db: dbMock, dialect: 'postgresql' });
    server.registerModel(User).generateRoutes();
    app = server.getApp();
  });

  describe('GET /api/users', () => {
    it('should return paginated users list', async () => {
      const mockUsers = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Doe', email: 'jane@example.com' },
      ];

      let callCount = 0;
      dbMock.select.mockImplementation(() => {
        // first select = findAll data, second = count
        callCount++;
        if (callCount === 1) return new SelectChain(mockUsers);
        return new SelectChain([{ count: 2 }]);
      });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUsers);
      expect(response.body.meta.pagination).toEqual({ page: 1, limit: 10, total: 2, pages: 1 });
    });

    it('should apply pagination parameters', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ count: 0 }]));

      await request(app).get('/api/users?page=2&limit=5');

      // select called for both findAll and count
      expect(dbMock.select).toHaveBeenCalled();
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by id', async () => {
      const mockUser = { id: '1', name: 'John Doe', email: 'john@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([mockUser]));

      const response = await request(app).get('/api/users/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUser);
    });

    it('should return 404 when user not found', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([]));

      const response = await request(app).get('/api/users/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/users', () => {
    it('should create new user and return 201', async () => {
      const userData = { name: 'John Doe', email: 'john@example.com' };
      const createdUser = { id: 'uuid-1', ...userData };

      insertValuesMock.mockResolvedValue(undefined);
      dbMock.select.mockImplementation(() => new SelectChain([createdUser]));

      const response = await request(app).post('/api/users').send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(createdUser);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user and return updated data when all required fields provided', async () => {
      const updateData = { name: 'John Updated', email: 'john@example.com', password: 'secret' };
      const updatedUser = { id: '1', name: 'John Updated', email: 'john@example.com' };

      dbMock.select.mockImplementation(() => new SelectChain([updatedUser]));

      const response = await request(app).put('/api/users/1').send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedUser);
    });

    it('should return 422 when required fields are missing', async () => {
      const response = await request(app)
        .put('/api/users/1')
        .send({ name: 'John Updated' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('should accept partial update with only one field', async () => {
      const updatedUser = { id: '1', name: 'John Updated', email: 'john@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([updatedUser]));

      const response = await request(app)
        .patch('/api/users/1')
        .send({ name: 'John Updated' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user and return 204', async () => {
      const existingUser = { id: '1', name: 'John Doe', email: 'john@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([existingUser]));

      const response = await request(app).delete('/api/users/1');

      expect(response.status).toBe(204);
    });
  });
});
