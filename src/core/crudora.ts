import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { z } from 'zod';
import { Repository } from './repository';
import { SchemaGenerator } from './schemaGenerator';
import { ValidationGenerator } from '../utils/validation';
import { Model, ModelConstructor } from './model';

export class Crudora {
  private prisma: PrismaClient;
  private models: Map<string, ModelConstructor> = new Map();
  private repositories: Map<string, Repository<any>> = new Map();
  private customRoutes: Array<{
    method: string;
    path: string;
    handler: (req: any, res: any) => void;
  }> = [];

  constructor(prisma?: PrismaClient) {
    if (!prisma) {
      console.warn('⚠️  No Prisma client provided. Make sure to install @prisma/client and prisma, then initialize PrismaClient.');
      throw new Error('PrismaClient is required. Please provide a PrismaClient instance.');
    }
    this.prisma = prisma;
  }

  registerModel(...modelClasses: ModelConstructor[]): this {
    for (const modelClass of modelClasses) {
      const modelName = modelClass.name;
      this.models.set(modelName, modelClass);

      const repository = new Repository(modelClass, this.prisma);
      this.repositories.set(modelName, repository);
    }
    return this;
  }

  getRepository<T extends Model>(modelClass: ModelConstructor<T>): Repository<T> {
    const repository = this.repositories.get(modelClass.name);
    if (!repository) {
      throw new Error(`Repository for ${modelClass.name} not found. Did you register the model?`);
    }
    return repository;
  }

  generatePrismaSchema(databaseProvider?: string): string {
    const modelClasses = Array.from(this.models.values());
    return SchemaGenerator.generatePrismaSchema(modelClasses, databaseProvider);
  }

  getValidationSchema<T extends Model>(modelClass: ModelConstructor<T>): z.ZodType<Partial<T>> {
    return ValidationGenerator.generateZodSchema(modelClass as any);
  }

  getStrictValidationSchema<T extends Model>(modelClass: ModelConstructor<T>): z.ZodType<T> {
    return ValidationGenerator.generateStrictZodSchema(modelClass as any);
  }

  // Custom route methods
  get(path: string, handler: (req: any, res: any) => void): this {
    this.customRoutes.push({ method: 'GET', path, handler });
    return this;
  }

  post(path: string, handler: (req: any, res: any) => void): this {
    this.customRoutes.push({ method: 'POST', path, handler });
    return this;
  }

  put(path: string, handler: (req: any, res: any) => void): this {
    this.customRoutes.push({ method: 'PUT', path, handler });
    return this;
  }

  delete(path: string, handler: (req: any, res: any) => void): this {
    this.customRoutes.push({ method: 'DELETE', path, handler });
    return this;
  }

  patch(path: string, handler: (req: any, res: any) => void): this {
    this.customRoutes.push({ method: 'PATCH', path, handler });
    return this;
  }

  // Auto-generate REST API routes
  generateRoutes(app: Express, basePath: string = '/api'): void {
    // Generate CRUD routes for models
    for (const [modelName, modelClass] of this.models) {
      const repository = this.getRepository(modelClass);
      const validationSchema = this.getValidationSchema(modelClass);
      const routePath = `${basePath}/${modelClass.getTableName()}`;

      // GET /api/model - List all
      app.get(routePath, async (req, res) => {
        try {
          const { page = 1, limit = 10, ...filters } = req.query;
          const skip = (Number(page) - 1) * Number(limit);

          const items = await repository.findAll({
            skip,
            take: Number(limit),
            where: filters
          });

          const total = await repository.count(filters);

          res.json({
            data: items,
            pagination: {
              page: Number(page),
              limit: Number(limit),
              total,
              pages: Math.ceil(total / Number(limit))
            }
          });
        } catch (error) {
          res.status(500).json({ error: 'Internal server error' });
        }
      });

      // GET /api/model/:id - Get by ID
      app.get(`${routePath}/:id`, async (req, res) => {
        try {
          const item = await repository.findById(req.params.id);
          if (!item) {
            return res.status(404).json({ error: 'Not found' });
          }
          res.json(item);
        } catch (error) {
          res.status(500).json({ error: 'Internal server error' });
        }
      });

      // POST /api/model - Create (gunakan strict validation)
      app.post(routePath, async (req, res) => {
        try {
          const strictValidationSchema = this.getStrictValidationSchema(modelClass);
          const validatedData = strictValidationSchema.parse(req.body);
          const item = await repository.create(validatedData);
          res.status(201).json(item);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
          }
          res.status(500).json({ error: 'Internal server error' });
        }
      });

      // PUT /api/model/:id - Update (gunakan partial validation)
      app.put(`${routePath}/:id`, async (req, res) => {
        try {
          const validationSchema = this.getValidationSchema(modelClass);
          const validatedData = validationSchema.parse(req.body);
          const item = await repository.update(req.params.id, validatedData);
          res.json(item);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
          }
          res.status(500).json({ error: 'Internal server error' });
        }
      });

      // DELETE /api/model/:id - Delete
      app.delete(`${routePath}/:id`, async (req, res) => {
        try {
          await repository.delete(req.params.id);
          res.status(204).send();
        } catch (error) {
          res.status(500).json({ error: 'Internal server error' });
        }
      });
    }

    // Generate custom routes
    for (const route of this.customRoutes) {
      const fullPath = `${basePath}${route.path}`;
      switch (route.method.toLowerCase()) {
        case 'get':
          app.get(fullPath, route.handler);
          break;
        case 'post':
          app.post(fullPath, route.handler);
          break;
        case 'put':
          app.put(fullPath, route.handler);
          break;
        case 'delete':
          app.delete(fullPath, route.handler);
          break;
        case 'patch':
          app.patch(fullPath, route.handler);
          break;
      }
    }
  }
}
