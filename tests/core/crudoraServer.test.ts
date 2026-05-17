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

  describe('health check', () => {
    it('GET /health returns ok when healthCheck is true (default)', async () => {
      server.generateRoutes();
      const response = await request(server.getApp()).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('mounts health check on custom path when healthCheck is a string', async () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        healthCheck: '/healthz',
        rateLimit: false,
      });
      s.generateRoutes();

      const ok = await request(s.getApp()).get('/healthz');
      const miss = await request(s.getApp()).get('/health');

      expect(ok.status).toBe(200);
      expect(ok.body.data.status).toBe('ok');
      expect(miss.status).toBe(404);
    });

    it('does not mount health check when healthCheck is false', async () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        healthCheck: false,
        rateLimit: false,
      });
      s.generateRoutes();
      const response = await request(s.getApp()).get('/health');
      expect(response.status).toBe(404);
    });
  });

  describe('timeout middleware', () => {
    it('returns 503 when handler does not respond within timeout', async () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        timeout: 80,
        rateLimit: false,
      });
      s.get('/slow', () => { /* never responds */ });
      s.generateRoutes();

      const response = await request(s.getApp()).get('/api/slow');
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('TIMEOUT');
    }, 5000);

    it('does not interfere when handler responds before timeout', async () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        timeout: 2000,
        rateLimit: false,
      });
      s.get('/fast', (_req, res) => res.json({ ok: true }));
      s.generateRoutes();

      const response = await request(s.getApp()).get('/api/fast');
      expect(response.status).toBe(200);
    });
  });

  describe('CORS modes', () => {
    it('reflects specific origin when cors is a string', async () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        cors: 'https://app.example.com',
        rateLimit: false,
      });
      s.get('/ping', (_req, res) => res.json({ ok: true }));
      s.generateRoutes();

      const response = await request(s.getApp())
        .get('/api/ping')
        .set('Origin', 'https://app.example.com');

      expect(response.headers['access-control-allow-origin']).toBe('https://app.example.com');
      expect(response.headers['vary']).toContain('Origin');
    });

    it('reflects matching origin from an array', async () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        cors: ['https://app.example.com', 'https://other.example.com'],
        rateLimit: false,
      });
      s.get('/ping', (_req, res) => res.json({ ok: true }));
      s.generateRoutes();

      const response = await request(s.getApp())
        .get('/api/ping')
        .set('Origin', 'https://app.example.com');

      expect(response.headers['access-control-allow-origin']).toBe('https://app.example.com');
      expect(response.headers['vary']).toContain('Origin');
    });

    it('does not reflect a non-matching origin from an array', async () => {
      const s = new CrudoraServer({
        db: dbMock,
        dialect: 'postgresql',
        cors: ['https://app.example.com'],
        rateLimit: false,
      });
      s.get('/ping', (_req, res) => res.json({ ok: true }));
      s.generateRoutes();

      const response = await request(s.getApp())
        .get('/api/ping')
        .set('Origin', 'https://evil.com');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('logger options', () => {
    it('accepts logger: false to disable logging', () => {
      const s = new CrudoraServer({ db: dbMock, dialect: 'postgresql', logger: false });
      expect(s).toBeInstanceOf(CrudoraServer);
    });

    it('accepts a custom logger object', () => {
      const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
      const s = new CrudoraServer({ db: dbMock, dialect: 'postgresql', logger });
      expect(s).toBeInstanceOf(CrudoraServer);
    });

    it('default logger (no logger option) logs errors to console on route failure', async () => {
      const s = new CrudoraServer({ db: dbMock, dialect: 'postgresql', rateLimit: false });
      s.registerModel(TestUser).generateRoutes();
      dbMock.select.mockImplementation(() => { throw new Error('DB error'); });
      const response = await request(s.getApp()).get('/api/users');
      expect(response.status).toBe(500);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('registerTable', () => {
    it('registers a model with a pre-built table and returns this', () => {
      const fakeTable = { _: { name: 'users' } };
      expect(server.registerTable(TestUser, fakeTable)).toBe(server);
    });
  });

  describe('getTable', () => {
    it('returns the Drizzle table for a registered model', () => {
      server.registerModel(TestUser);
      const table = server.getTable(TestUser);
      expect(table).toBeDefined();
    });

    it('throws for an unregistered model', () => {
      expect(() => server.getTable(TestUser)).toThrow();
    });
  });

  describe('custom route HTTP methods', () => {
    it('serves custom PUT, PATCH, and DELETE routes', async () => {
      server.put('/item', (_req, res) => res.json({ method: 'PUT' }));
      server.patch('/item', (_req, res) => res.json({ method: 'PATCH' }));
      server.delete('/item', (_req, res) => res.status(204).send());
      server.generateRoutes();

      const putRes   = await request(server.getApp()).put('/api/item');
      const patchRes = await request(server.getApp()).patch('/api/item');
      const delRes   = await request(server.getApp()).delete('/api/item');

      expect(putRes.body.method).toBe('PUT');
      expect(patchRes.body.method).toBe('PATCH');
      expect(delRes.status).toBe(204);
    });
  });

  describe('listen and getHttpServer', () => {
    it('getHttpServer() returns null before listen()', () => {
      const s = new CrudoraServer({ db: dbMock, dialect: 'postgresql', rateLimit: false });
      expect(s.getHttpServer()).toBeNull();
    });

    it('listen() returns an http.Server and updates getHttpServer()', (done) => {
      const s = new CrudoraServer({ db: dbMock, dialect: 'postgresql', port: 0, rateLimit: false });
      const httpServer = s.listen(() => {
        expect(httpServer).toBeDefined();
        expect(s.getHttpServer()).toBe(httpServer);
        httpServer.close(done);
      });
    });
  });
});
