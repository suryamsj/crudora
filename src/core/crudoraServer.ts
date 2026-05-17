import express, { Express } from 'express';
import { randomUUID } from 'crypto';
import { Crudora } from './crudora';
import { Model, ModelConstructor } from './model';
import { Dialect } from '../types/model.type';
import { CrudoraLogger } from '../types/logger.type';

export type { CrudoraLogger };

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Sliding-window duration in milliseconds. Default: `60_000` (1 minute). */
  windowMs?: number;
  /** Maximum number of requests per key per window. Default: `100`. */
  max?: number;
  /** Message body returned with 429 responses. Default: `'Too many requests'`. */
  message?: string;
  /**
   * Function that extracts the rate-limit key from a request.
   * Default: `req.ip` (the direct connection IP, or `X-Forwarded-For` if `trust proxy` is set on Express).
   */
  keyGenerator?: (req: any) => string;
}

function createRateLimiter(config: Required<RateLimitConfig>): (req: any, res: any, next: any) => void {
  // Per-key sliding window: key → array of hit timestamps
  const store = new Map<string, number[]>();

  // Sweep expired entries once per window so the Map doesn't grow unboundedly
  const timer = setInterval(() => {
    const cutoff = Date.now() - config.windowMs;
    for (const [key, hits] of store.entries()) {
      const active = hits.filter((t) => t > cutoff);
      if (active.length === 0) store.delete(key);
      else store.set(key, active);
    }
  }, config.windowMs);
  // Don't prevent the process from exiting naturally
  if (timer.unref) timer.unref();

  return (req: any, res: any, next: any) => {
    const key = config.keyGenerator(req);
    const now = Date.now();
    const cutoff = now - config.windowMs;

    const hits = (store.get(key) ?? []).filter((t) => t > cutoff);
    const remaining = Math.max(0, config.max - hits.length - 1);
    const resetAt = Math.ceil((now + config.windowMs) / 1000);

    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetAt);

    if (hits.length >= config.max) {
      res.setHeader('Retry-After', Math.ceil(config.windowMs / 1000));
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: config.message },
      });
    }

    hits.push(now);
    store.set(key, hits);
    next();
  };
}

// ─── Logger ───────────────────────────────────────────────────────────────────

function createDefaultLogger(): CrudoraLogger {
  const fmt = (level: string, msg: string, ctx?: Record<string, any>) =>
    JSON.stringify({ level, time: new Date().toISOString(), msg, ...ctx });
  return {
    error: (msg, ctx) => console.error(fmt('error', msg, ctx)),
    warn:  (msg, ctx) => console.warn(fmt('warn',  msg, ctx)),
    info:  (msg, ctx) => console.info(fmt('info',  msg, ctx)),
    debug: (msg, ctx) => console.debug(fmt('debug', msg, ctx)),
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface CrudoraServerConfig {
  port?: number;
  /**
   * CORS configuration.
   * - `true` (default): allow all origins (`*`)
   * - `false`: disable CORS headers entirely
   * - `string`: allow a single specific origin, e.g. `'https://app.example.com'`
   * - `string[]`: allow a list of origins; the request's Origin is reflected if it matches
   */
  cors?: boolean | string | string[];
  bodyParser?: boolean;
  /**
   * Maximum request body size accepted by the JSON and URL-encoded body parsers.
   * Accepts a number (bytes) or a string with a unit suffix (`'100kb'`, `'5mb'`).
   * Default: `'100kb'`.
   */
  bodyParserLimit?: string | number;
  db: any;
  dialect: Dialect;
  basePath?: string;
  /**
   * Logger for request errors and lifecycle events.
   * - Omit (default): structured JSON written to console (compatible with log aggregators).
   * - Pass a pino/winston instance or any object with `error`, `warn`, `info`, `debug` methods.
   * - Pass `false` to disable all Crudora logging.
   */
  logger?: CrudoraLogger | false;
  /**
   * Built-in sliding-window rate limiter applied to every route.
   * - Omit / `undefined` (default): enabled with 100 requests per minute per IP.
   * - Pass a `RateLimitConfig` object to customise the window, limit, or key function.
   * - Pass `false` to disable rate limiting entirely (e.g. when using an external proxy-level limiter).
   */
  rateLimit?: RateLimitConfig | false;
}

type ResolvedConfig = Required<Omit<CrudoraServerConfig, 'logger' | 'rateLimit'>> & {
  logger: CrudoraLogger | false;
  rateLimit: Required<RateLimitConfig> | false;
};

// ─── Server ───────────────────────────────────────────────────────────────────

export class CrudoraServer {
  private app: Express;
  private crudora: Crudora;
  private config: ResolvedConfig;

  constructor(config: CrudoraServerConfig) {
    const resolvedLogger: CrudoraLogger | false =
      config.logger === undefined ? createDefaultLogger() : config.logger;

    const resolvedRateLimit: Required<RateLimitConfig> | false =
      config.rateLimit === false
        ? false
        : {
            windowMs:     config.rateLimit?.windowMs     ?? 60_000,
            max:          config.rateLimit?.max          ?? 100,
            message:      config.rateLimit?.message      ?? 'Too many requests',
            keyGenerator: config.rateLimit?.keyGenerator ?? ((req: any) => String(req.ip ?? 'unknown')),
          };

    this.config = {
      port:            3000,
      cors:            true,
      bodyParser:      true,
      bodyParserLimit: '100kb',
      basePath:        '/api',
      ...config,
      logger:    resolvedLogger,
      rateLimit: resolvedRateLimit,
    };
    this.app = express();
    this.crudora = new Crudora(
      config.db,
      config.dialect,
      resolvedLogger === false ? undefined : resolvedLogger,
    );
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // Security headers — applied unconditionally on every response
    this.app.use((_req, res, next) => {
      // Prevent MIME-type sniffing (XSS vector for browsers that ignore Content-Type)
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Disallow embedding in iframes — protects against clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      // Explicitly disable the legacy XSS auditor — it can itself be abused
      res.setHeader('X-XSS-Protection', '0');
      next();
    });

    // Attach a unique correlation ID to every incoming request
    this.app.use((req: any, _res, next) => {
      req.correlationId = randomUUID();
      next();
    });

    // Rate limiting — applied before body parsing so abusive requests are rejected
    // before we spend CPU deserializing their body
    if (this.config.rateLimit !== false) {
      this.app.use(createRateLimiter(this.config.rateLimit));
    }

    if (this.config.bodyParser) {
      this.app.use(express.json({ limit: this.config.bodyParserLimit }));
      this.app.use(express.urlencoded({ extended: true, limit: this.config.bodyParserLimit }));
    }

    if (this.config.cors !== false) {
      this.app.use((req, res, next) => {
        const cors = this.config.cors;
        if (cors === true || cors === undefined) {
          res.header('Access-Control-Allow-Origin', '*');
        } else if (typeof cors === 'string') {
          res.header('Access-Control-Allow-Origin', cors);
          res.header('Vary', 'Origin');
        } else if (Array.isArray(cors)) {
          const requestOrigin = req.headers.origin;
          if (requestOrigin && cors.includes(requestOrigin)) {
            res.header('Access-Control-Allow-Origin', requestOrigin);
            res.header('Vary', 'Origin');
          }
        }
        res.header('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
          res.sendStatus(204);
        } else {
          next();
        }
      });
    }
  }

  registerModel(...modelClasses: ModelConstructor[]): this {
    this.crudora.registerModel(...modelClasses);
    return this;
  }

  registerTable<T extends Model>(modelClass: ModelConstructor<T>, table: any): this {
    this.crudora.registerTable(modelClass, table);
    return this;
  }

  generateRoutes(): this {
    this.crudora.generateRoutes(this.app, this.config.basePath);
    return this;
  }

  use(middleware: any): this {
    this.app.use(middleware);
    return this;
  }

  listen(callback?: () => void): void {
    this.app.listen(this.config.port, () => {
      console.log(`🚀 Crudora server running on port ${this.config.port}`);
      console.log(`📚 API available at http://localhost:${this.config.port}${this.config.basePath}`);
      if (callback) callback();
    });
  }

  getApp(): Express {
    return this.app;
  }

  getCrudora(): Crudora {
    return this.crudora;
  }

  /**
   * Returns the Drizzle table object for a registered model — delegates to `Crudora.getTable()`.
   * Use this when you need raw DB access to columns excluded by `static hidden`
   * (e.g. a login route that must read the password hash).
   *
   * @example
   * const usersTable = server.getTable(User);
   * const [row] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
   */
  getTable<T extends Model>(modelClass: ModelConstructor<T>): any {
    return this.crudora.getTable(modelClass);
  }

  get(path: string, ...handlers: Array<(req: any, res: any, next?: any) => void>): this {
    this.crudora.get(path, ...handlers);
    return this;
  }

  post(path: string, ...handlers: Array<(req: any, res: any, next?: any) => void>): this {
    this.crudora.post(path, ...handlers);
    return this;
  }

  put(path: string, ...handlers: Array<(req: any, res: any, next?: any) => void>): this {
    this.crudora.put(path, ...handlers);
    return this;
  }

  delete(path: string, ...handlers: Array<(req: any, res: any, next?: any) => void>): this {
    this.crudora.delete(path, ...handlers);
    return this;
  }

  patch(path: string, ...handlers: Array<(req: any, res: any, next?: any) => void>): this {
    this.crudora.patch(path, ...handlers);
    return this;
  }
}
