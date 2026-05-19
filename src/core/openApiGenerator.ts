import { getFieldMetadata } from '../decorators/model';
import { FieldOptions } from '../types/model.type';
import { ModelConstructor } from './model';

const SYSTEM_FIELDS = new Set(['createdAt', 'updatedAt', 'deletedAt']);

function fieldToSchema(opts: FieldOptions): Record<string, any> {
  switch (opts.type) {
    case 'uuid':    return { type: 'string', format: 'uuid' };
    case 'text':    return { type: 'string' };
    case 'integer': return { type: 'integer' };
    case 'number':  return { type: 'number', format: 'double' };
    case 'boolean': return { type: 'boolean' };
    case 'date':    return { type: 'string', format: 'date-time' };
    case 'decimal': return { type: 'number', format: 'decimal' };
    case 'json':    return { type: 'object' };
    case 'enum':    return { type: 'string', enum: opts.enumValues ?? [] };
    case 'bigint':  return { type: 'integer', format: 'int64' };
    case 'serial':  return { type: 'integer' };
    case 'array':   return { type: 'array', items: { type: 'string' } };
    default: {
      const s: Record<string, any> = { type: 'string' };
      if (opts.length) s.maxLength = opts.length;
      return s;
    }
  }
}

function buildOutputSchema(modelClass: ModelConstructor): Record<string, any> {
  const fields = getFieldMetadata(modelClass) as Record<string, FieldOptions>;
  const hidden = new Set(modelClass.hidden ?? []);
  const properties: Record<string, any> = {};

  for (const [name, opts] of Object.entries(fields)) {
    if (hidden.has(name)) continue;
    const schema = fieldToSchema(opts);
    if (opts.nullable) schema.nullable = true;
    properties[name] = schema;
  }

  if (modelClass.timestamps !== false) {
    properties.createdAt = { type: 'string', format: 'date-time' };
    properties.updatedAt = { type: 'string', format: 'date-time' };
  }
  if (modelClass.softDelete) {
    properties.deletedAt = { type: 'string', format: 'date-time', nullable: true };
  }

  return { type: 'object', properties };
}

function buildInputSchema(modelClass: ModelConstructor): Record<string, any> {
  const fields = getFieldMetadata(modelClass) as Record<string, FieldOptions>;
  const fillable = modelClass.fillable;
  const properties: Record<string, any> = {};
  const required: string[] = [];

  let entries = Object.entries(fields).filter(
    ([name, opts]) => !opts.primary && !SYSTEM_FIELDS.has(name),
  );
  if (fillable?.length) {
    entries = entries.filter(([name]) => fillable.includes(name));
  }

  for (const [name, opts] of entries) {
    const schema = fieldToSchema(opts);
    if (opts.nullable) schema.nullable = true;
    properties[name] = schema;
    if (opts.required && !opts.nullable) required.push(name);
  }

  const schema: Record<string, any> = { type: 'object', properties };
  if (required.length > 0) schema.required = required;
  return schema;
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function itemLabel(tableName: string): string {
  return tableName.endsWith('s') ? tableName.slice(0, -1) : tableName;
}

const listResponse = (ref: string) => ({
  description: 'OK',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: ref } },
          meta: {
            type: 'object',
            properties: {
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  pages: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
});

const itemResponse = (ref: string, status = 'OK') => ({
  description: status,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: ref },
        },
      },
    },
  },
});

const errorResponse = (description: string, code: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: code },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
});

const validationError = {
  description: 'Validation Error',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const idParam = { in: 'path', name: 'id', required: true, schema: { type: 'string' } };

export interface OpenApiInfo {
  title?: string;
  version?: string;
  description?: string;
}

export class OpenApiGenerator {
  static generate(
    models: Map<string, ModelConstructor>,
    customRoutes: Array<{ method: string; path: string }>,
    basePath: string,
    info?: OpenApiInfo,
  ): Record<string, any> {
    const schemas: Record<string, any> = {};
    const paths: Record<string, any> = {};

    for (const [, modelClass] of models) {
      const tableName = modelClass.getTableName();
      const tag = capital(tableName);
      const item = itemLabel(tableName);
      const ref = `#/components/schemas/${tag}`;
      const inputRef = `#/components/schemas/${tag}Input`;
      const col = `${basePath}/${tableName}`;
      const byId = `${basePath}/${tableName}/{id}`;

      schemas[tag] = buildOutputSchema(modelClass);
      schemas[`${tag}Input`] = buildInputSchema(modelClass);

      paths[col] = {
        get: {
          summary: `List ${tableName}`,
          operationId: `list${tag}`,
          tags: [tag],
          parameters: [
            { in: 'query', name: 'page',        schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit',        schema: { type: 'integer', default: 10 } },
            { in: 'query', name: 'cursor',       schema: { type: 'string' } },
            { in: 'query', name: 'sortBy',       schema: { type: 'string' } },
            { in: 'query', name: 'sortOrder',    schema: { type: 'string', enum: ['asc', 'desc'] } },
            { in: 'query', name: 'withDeleted',  schema: { type: 'boolean' } },
          ],
          responses: { '200': listResponse(ref) },
        },
        post: {
          summary: `Create ${item}`,
          operationId: `create${tag}`,
          tags: [tag],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: inputRef } } },
          },
          responses: {
            '201': itemResponse(ref, 'Created'),
            '422': validationError,
          },
        },
      };

      paths[byId] = {
        get: {
          summary: `Get ${item} by ID`,
          operationId: `get${tag}ById`,
          tags: [tag],
          parameters: [idParam],
          responses: {
            '200': itemResponse(ref),
            '404': errorResponse('Not Found', 'NOT_FOUND'),
          },
        },
        put: {
          summary: `Replace ${item}`,
          operationId: `replace${tag}`,
          tags: [tag],
          parameters: [idParam],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: inputRef } } },
          },
          responses: {
            '200': itemResponse(ref),
            '404': errorResponse('Not Found', 'NOT_FOUND'),
            '422': validationError,
          },
        },
        patch: {
          summary: `Update ${item}`,
          operationId: `update${tag}`,
          tags: [tag],
          parameters: [idParam],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: inputRef } } },
          },
          responses: {
            '200': itemResponse(ref),
            '404': errorResponse('Not Found', 'NOT_FOUND'),
            '422': validationError,
          },
        },
        delete: {
          summary: `Delete ${item}`,
          operationId: `delete${tag}`,
          tags: [tag],
          parameters: [idParam],
          responses: {
            '200': itemResponse(ref),
            '404': errorResponse('Not Found', 'NOT_FOUND'),
          },
        },
      };
    }

    for (const route of customRoutes) {
      const fullPath = `${basePath}${route.path}`.replace(/:([a-zA-Z_]+)/g, '{$1}');
      if (!paths[fullPath]) paths[fullPath] = {};
      paths[fullPath][route.method.toLowerCase()] = {
        summary: `${route.method} ${route.path}`,
        tags: ['Custom'],
        responses: { '200': { description: 'OK' } },
      };
    }

    const spec: Record<string, any> = {
      openapi: '3.0.0',
      info: {
        title: info?.title ?? 'Crudora API',
        version: info?.version ?? '1.0.0',
      },
      paths,
      components: { schemas },
    };
    if (info?.description) spec.info.description = info.description;
    return spec;
  }
}
