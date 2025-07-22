import express, { Express } from 'express';
import { Crudora } from './crudora';
import { PrismaClient } from '@prisma/client';
import { Model, ModelConstructor } from './model';

export interface CrudoraServerConfig {
  port?: number;
  cors?: boolean;
  bodyParser?: boolean;
  prisma?: PrismaClient;
  basePath?: string;
}

export class CrudoraServer {
  private app: Express;
  private crudora: Crudora;
  private config: CrudoraServerConfig;

  constructor(config: CrudoraServerConfig = {}) {
    this.config = { port: 3000, cors: true, bodyParser: true, basePath: '/api', ...config };
    this.app = express();
    this.crudora = new Crudora(config.prisma);
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    if (this.config.bodyParser) {
      this.app.use(express.json());
      this.app.use(express.urlencoded({ extended: true }));
    }

    if (this.config.cors) {
      this.app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
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

  get(path: string, handler: (req: any, res: any) => void): this {
    this.crudora.get(path, handler);
    return this;
  }

  post(path: string, handler: (req: any, res: any) => void): this {
    this.crudora.post(path, handler);
    return this;
  }

  put(path: string, handler: (req: any, res: any) => void): this {
    this.crudora.put(path, handler);
    return this;
  }

  delete(path: string, handler: (req: any, res: any) => void): this {
    this.crudora.delete(path, handler);
    return this;
  }

  patch(path: string, handler: (req: any, res: any) => void): this {
    this.crudora.patch(path, handler);
    return this;
  }
}
