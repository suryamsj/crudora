import http from 'http';
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

// ─── Docs ─────────────────────────────────────────────────────────────────────

/**
 * Configuration options forwarded to `@scalar/express-api-reference`.
 * All known options are typed for autocomplete. Any additional option is also
 * accepted via the index signature.
 *
 * Full reference: https://github.com/scalar/scalar/blob/main/documentation/configuration.md
 */
export interface ScalarConfig {
  /**
   * UI color theme.
   * @default 'default'
   */
  theme?: 'default' | 'alternate' | 'moon' | 'purple' | 'solarized' | 'mars' | 'deepSpace' | 'none';
  /**
   * Page layout style.
   * @default 'modern'
   */
  layout?: 'modern' | 'classic';
  /** Enable dark mode by default. */
  darkMode?: boolean;
  /** Force light or dark mode, ignoring system preference. */
  forceDarkModeState?: 'dark' | 'light';
  /** Hide the dark-mode toggle button. */
  hideDarkModeToggle?: boolean;
  /** Hide the model/schema section. */
  hideModels?: boolean;
  /** Hide the "Download" button in the spec header. */
  hideDownloadButton?: boolean;
  /** Hide the "Test Request" (client) button on each operation. */
  hideClientButton?: boolean;
  /** Show or hide the sidebar. @default true */
  showSidebar?: boolean;
  /** Expand all operation tags on load. */
  defaultOpenAllTags?: boolean;
  /** Inject custom CSS into the Scalar page. */
  customCss?: string;
  /** Custom favicon URL or data URI. */
  favicon?: string;
  /** Keyboard shortcut that opens the search dialog. @default 'k' */
  searchHotKey?: string;
  /**
   * Override the server list shown in the UI.
   * Each entry is `{ url: string; description?: string }`.
   */
  servers?: Array<{ url: string; description?: string; [key: string]: any }>;
  /**
   * Default values pre-filled in the "Try it out" form — useful for dev tokens.
   * Shape depends on your security scheme; see Scalar docs for details.
   */
  authentication?: Record<string, any>;
  /**
   * HTML `<meta>` / Open Graph values for the docs page.
   * Accepts `title`, `description`, `ogDescription`, `ogTitle`, `ogImage`, `twitterTitle`.
   */
  metaData?: {
    title?: string;
    description?: string;
    ogDescription?: string;
    ogTitle?: string;
    ogImage?: string;
    twitterTitle?: string;
    [key: string]: any;
  };
  /** Use Scalar's default font stack. @default true */
  withDefaultFonts?: boolean;
  /** Allow users to edit the spec inline (read-only by default). */
  isEditable?: boolean;
  /** Any other Scalar option not listed above. */
  [key: string]: any;
}

export interface DocsConfig {
  /** Path where the UI and spec are served. Default: `'/docs'`. */
  path?: string;
  /** OpenAPI `info.title`. Default: `'Crudora API'`. */
  title?: string;
  /** OpenAPI `info.version`. Default: `'1.0.0'`. */
  version?: string;
  /** OpenAPI `info.description`. */
  description?: string;
  /**
   * Options forwarded directly to `apiReference()` from `@scalar/express-api-reference`.
   * Fully typed for autocomplete — see `ScalarConfig` for all available fields.
   *
   * @example
   * scalar: { theme: 'purple', darkMode: true, layout: 'classic' }
   */
  scalar?: ScalarConfig;
}

interface ResolvedDocsConfig {
  path: string;
  title?: string;
  version?: string;
  description?: string;
  scalar?: ScalarConfig;
}

function resolveDocs(docs: boolean | string | DocsConfig | undefined): ResolvedDocsConfig | false {
  if (!docs) return false;
  if (docs === true) return { path: '/docs' };
  if (typeof docs === 'string') return { path: docs };
  return { path: docs.path ?? '/docs', ...docs };
}

/**
 * Dynamically requires `@scalar/express-api-reference` at runtime.
 * Works in CJS Node.js. In native ESM without a bundler, `require` is not in
 * scope — the ReferenceError is caught and null is returned gracefully.
 */
function tryRequireScalar(): { apiReference: (opts: any) => any } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@scalar/express-api-reference');
  } catch {
    return null;
  }
}

function buildInstallPromptHtml(specUrl: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>API Docs</title>
    <meta charset="utf-8" />
    <style>
      body { font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; padding: 0 24px; color: #333; }
      code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
      pre  { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow: auto; }
      a    { color: #0070f3; }
    </style>
  </head>
  <body>
    <h2>API Docs</h2>
    <p>Install <code>@scalar/express-api-reference</code> to enable the interactive UI:</p>
    <pre>npm install @scalar/express-api-reference</pre>
    <p>OpenAPI spec: <a href="${specUrl}">${specUrl}</a></p>
  </body>
</html>`;
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
   *
   * **Important:** This limiter is in-memory and per-process. In multi-instance deployments
   * (load balancer, Kubernetes replicas), each instance tracks its own counter independently —
   * the effective limit per client is `max × instanceCount`. Use a Redis-backed limiter
   * (e.g. `rate-limiter-flexible`) and pass `rateLimit: false` to disable this one.
   */
  rateLimit?: RateLimitConfig | false;
  /**
   * Socket-level request timeout in milliseconds.
   * Requests that exceed this duration are terminated with a `503` response.
   * - Omit / `0` (default): no timeout.
   * - Recommended: `30_000` (30 s) for most APIs.
   */
  timeout?: number;
  /**
   * Built-in health check endpoint.
   * - `true` (default): mounts `GET /health` returning `{ status: 'ok' }`.
   * - `string`: custom path, e.g. `'/healthz'`.
   * - `false`: disable entirely.
   */
  healthCheck?: boolean | string;
  /**
   * Built-in API documentation powered by Scalar.
   * Requires `@scalar/express-api-reference` to be installed separately.
   *
   * - `false` (default): disabled.
   * - `true`: mount UI at `GET /docs` and spec at `GET /docs/openapi.json`.
   * - `string`: custom base path, e.g. `'/api-docs'`.
   * - `DocsConfig`: full control — path, OpenAPI info, Scalar theme/layout/etc.
   *
   * @example
   * docs: { path: '/docs', title: 'My API', scalar: { theme: 'purple' } }
   */
  docs?: boolean | string | DocsConfig;
}

type ResolvedConfig = Required<Omit<CrudoraServerConfig, 'logger' | 'rateLimit' | 'docs'>> & {
  logger: CrudoraLogger | false;
  rateLimit: Required<RateLimitConfig> | false;
  timeout: number;
  healthCheck: boolean | string;
  docs: ResolvedDocsConfig | false;
};

// ─── Server ───────────────────────────────────────────────────────────────────

export class CrudoraServer {
  private app: Express;
  private crudora: Crudora;
  private config: ResolvedConfig;
  private httpServer: http.Server | null = null;

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
      timeout:         0,
      healthCheck:     true,
      ...config,
      logger:    resolvedLogger,
      rateLimit: resolvedRateLimit,
      docs:      resolveDocs(config.docs),
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

    // Request timeout — sends 503 if the handler hasn't responded within the window.
    // Applied early so it covers body parsing, route handling, and DB queries.
    if (this.config.timeout > 0) {
      const timeoutMs = this.config.timeout;
      this.app.use((_req, res, next) => {
        const timer = setTimeout(() => {
          if (!res.headersSent) {
            res.status(503).json({ success: false, error: { code: 'TIMEOUT', message: 'Request timed out' } });
          }
        }, timeoutMs);
        res.on('finish', () => clearTimeout(timer));
        res.on('close',  () => clearTimeout(timer));
        next();
      });
    }

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
    if (this.config.healthCheck !== false) {
      const healthPath = typeof this.config.healthCheck === 'string'
        ? this.config.healthCheck
        : '/health';
      this.app.get(healthPath, (_req, res) => {
        res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
      });
    }

    if (this.config.docs !== false) {
      const { path: docsPath, title, version, description, scalar: scalarOpts } = this.config.docs;
      const specPath = `${docsPath}/openapi.json`;
      const spec = this.crudora.generateOpenApiSpec(this.config.basePath, { title, version, description });

      // Always serve the raw OpenAPI JSON spec
      this.app.get(specPath, (_req, res) => {
        res.json(spec);
      });

      const scalarPkg = tryRequireScalar();
      if (scalarPkg) {
        // Mount Scalar UI with user-supplied options merged in
        this.app.use(docsPath, scalarPkg.apiReference({
          spec: { url: specPath },
          ...scalarOpts,
        }));
      } else {
        // Package not installed — serve a friendly install prompt
        if (this.config.logger !== false) {
          this.config.logger.warn(
            'docs is enabled but @scalar/express-api-reference is not installed. ' +
            'Run "npm install @scalar/express-api-reference" to enable the interactive UI.',
          );
        }
        this.app.get(docsPath, (_req, res) => {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.send(buildInstallPromptHtml(specPath));
        });
      }
    }

    this.crudora.generateRoutes(this.app, this.config.basePath);
    return this;
  }

  use(middleware: any): this {
    this.app.use(middleware);
    return this;
  }

  /**
   * Starts the HTTP server and returns the underlying `http.Server` instance.
   * Use the returned server for graceful shutdown:
   *
   * @example
   * const httpServer = server.listen();
   * process.on('SIGTERM', () => httpServer.close(() => process.exit(0)));
   */
  listen(callback?: () => void): http.Server {
    this.httpServer = http.createServer(this.app);
    this.httpServer.listen(this.config.port, () => {
      console.log(`🚀 Crudora server running on port ${this.config.port}`);
      console.log(`📚 API available at http://localhost:${this.config.port}${this.config.basePath}`);
      if (this.config.docs !== false) {
        console.log(`📖 API docs at http://localhost:${this.config.port}${this.config.docs.path}`);
      }
      if (callback) callback();
    });
    return this.httpServer;
  }

  /**
   * Returns the `http.Server` instance after `listen()` has been called, or `null` before.
   * Useful when you need the server reference without calling listen again.
   */
  getHttpServer(): http.Server | null {
    return this.httpServer;
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
