import { CrudoraServer } from '../../src/core/crudoraServer';
import { Model } from '../../src/core/model';
import { Field } from '../../src/decorators/model';
import { dbMock, insertValuesMock, SelectChain } from '../setup';
import request from 'supertest';

class TestUser extends Model {
  static tableName = 'users';
  static fillable = ['name', 'email'];

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string' })
  name!: string;

  @Field({ type: 'string' })
  email!: string;
}

describe('CrudoraServer', () => {
  let server: CrudoraServer;

  beforeEach(() => {
    server = new CrudoraServer({ db: dbMock, dialect: 'postgresql', port: 3001 });
  });

  describe('constructor', () => {
    it('should create server with default config', () => {
      const s = new CrudoraServer({ db: dbMock, dialect: 'postgresql' });
      expect(s).toBeInstanceOf(CrudoraServer);
    });

    it('should create server with custom config', () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        port: 4000,
        cors: false,
        bodyParser: false,
        basePath: '/v1',
      });
      expect(s).toBeInstanceOf(CrudoraServer);
    });
  });

  describe('middleware setup', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(server.getApp())
        .options('/api/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(204);
    });

    it('should parse JSON bodies and create records', async () => {
      server.registerModel(TestUser).generateRoutes();

      const createdUser = { id: 'uuid-1', name: 'John', email: 'john@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([createdUser]));
      insertValuesMock.mockResolvedValue(undefined);

      const response = await request(server.getApp())
        .post('/api/users')
        .send({ name: 'John', email: 'john@example.com' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
    });
  });

  describe('model registration', () => {
    it('should register models and return this', () => {
      expect(server.registerModel(TestUser)).toBe(server);
    });
  });

  describe('route generation', () => {
    it('should generate routes and return this', () => {
      expect(server.generateRoutes()).toBe(server);
    });
  });

  describe('custom routes', () => {
    it('should add and serve a custom GET route', async () => {
      server.get('/custom', (_req, res) => res.json({ message: 'Custom GET route' }));
      server.generateRoutes();

      const response = await request(server.getApp()).get('/api/custom');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Custom GET route');
    });

    it('should add and serve a custom POST route', async () => {
      server.post('/custom', (req, res) => res.json({ data: req.body }));
      server.generateRoutes();

      const response = await request(server.getApp())
        .post('/api/custom')
        .send({ test: 'data' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ test: 'data' });
    });
  });

  describe('middleware usage', () => {
    it('should allow adding custom middleware and return this', () => {
      const middleware = jest.fn((_req: any, _res: any, next: any) => next());
      expect(server.use(middleware)).toBe(server);
    });
  });

  describe('security headers', () => {
    it('should include security headers on every response', async () => {
      server.get('/ping', (_req, res) => res.json({ ok: true }));
      server.generateRoutes();

      const response = await request(server.getApp()).get('/api/ping');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
    });
  });

  describe('rate limiting', () => {
    it('should return 429 after exceeding the request limit', async () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        rateLimit: { windowMs: 60_000, max: 2 },
      });
      s.get('/ping', (_req, res) => res.json({ ok: true }));
      s.generateRoutes();
      const app = s.getApp();

      await request(app).get('/api/ping');
      await request(app).get('/api/ping');
      const response = await request(app).get('/api/ping');

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should include rate-limit headers on every response', async () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        rateLimit: { windowMs: 60_000, max: 10 },
      });
      s.get('/ping', (_req, res) => res.json({ ok: true }));
      s.generateRoutes();

      const response = await request(s.getApp()).get('/api/ping');

      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should disable rate limiting when rateLimit is false', async () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        rateLimit: false,
      });
      s.get('/ping', (_req, res) => res.json({ ok: true }));
      s.generateRoutes();
      const app = s.getApp();

      // Hit 5 times — no 429 expected
      for (let i = 0; i < 5; i++) {
        const r = await request(app).get('/api/ping');
        expect(r.status).toBe(200);
      }
    });
  });

  describe('body parser limit', () => {
    it('should reject bodies exceeding bodyParserLimit', async () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        bodyParserLimit: 10, // 10 bytes
        rateLimit: false,
      });
      s.post('/echo', (req, res) => res.json(req.body));
      s.generateRoutes();

      const response = await request(s.getApp())
        .post('/api/echo')
        .send({ data: 'x'.repeat(100) })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(413);
    });
  });

  describe('getters', () => {
    it('should return Express app', () => {
      expect(server.getApp()).toBeDefined();
    });

    it('should return Crudora instance', () => {
      expect(server.getCrudora()).toBeDefined();
    });
  });
});
