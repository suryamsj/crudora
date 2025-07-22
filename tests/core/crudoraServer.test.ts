import { CrudoraServer } from '../../src/core/crudoraServer';
import { Model } from '../../src/core/model';
import { prismaMock } from '../setup';
import request from 'supertest';

class TestUser extends Model {
  static tableName = 'users';
  static fillable = ['name', 'email'];
  
  id?: string;
  name?: string;
  email?: string;
}

describe('CrudoraServer', () => {
  let server: CrudoraServer;

  beforeEach(() => {
    server = new CrudoraServer({ prisma: prismaMock, port: 3001 });
  });

  describe('constructor', () => {
    it('should create server with default config', () => {
      const defaultServer = new CrudoraServer({ prisma: prismaMock });
      expect(defaultServer).toBeInstanceOf(CrudoraServer);
    });

    it('should create server with custom config', () => {
      const customServer = new CrudoraServer({
        prisma: prismaMock,
        port: 4000,
        cors: false,
        bodyParser: false,
        basePath: '/v1'
      });
      expect(customServer).toBeInstanceOf(CrudoraServer);
    });
  });

  describe('middleware setup', () => {
    it('should handle CORS preflight requests', async () => {
      const app = server.getApp();
      
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:3000');
      
      expect(response.status).toBe(200);
    });

    it('should parse JSON bodies', async () => {
      server.registerModel(TestUser).generateRoutes();
      prismaMock.users.create.mockResolvedValue({ id: '1', name: 'John', email: 'john@example.com' });
      
      const app = server.getApp();
      
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'John', email: 'john@example.com' })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(201);
    });
  });

  describe('model registration', () => {
    it('should register models', () => {
      const result = server.registerModel(TestUser);
      expect(result).toBe(server);
    });
  });

  describe('route generation', () => {
    it('should generate routes', () => {
      const result = server.generateRoutes();
      expect(result).toBe(server);
    });
  });

  describe('custom routes', () => {
    it('should add custom GET route', async () => {
      server.get('/custom', (req, res) => {
        res.json({ message: 'Custom GET route' });
      });
      server.generateRoutes();
      
      const app = server.getApp();
      const response = await request(app).get('/api/custom');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Custom GET route');
    });

    it('should add custom POST route', async () => {
      server.post('/custom', (req, res) => {
        res.json({ message: 'Custom POST route', data: req.body });
      });
      server.generateRoutes();
      
      const app = server.getApp();
      const response = await request(app)
        .post('/api/custom')
        .send({ test: 'data' });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Custom POST route');
    });
  });

  describe('middleware usage', () => {
    it('should allow adding custom middleware', () => {
      const middleware = jest.fn((req, res, next) => next());
      const result = server.use(middleware);
      
      expect(result).toBe(server);
    });
  });

  describe('getters', () => {
    it('should return Express app', () => {
      const app = server.getApp();
      expect(app).toBeDefined();
    });

    it('should return Crudora instance', () => {
      const crudora = server.getCrudora();
      expect(crudora).toBeDefined();
    });
  });
});