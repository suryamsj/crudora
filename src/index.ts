import 'reflect-metadata';
export { Crudora } from './core/crudora';
export { CrudoraServer } from './core/crudoraServer';
export { Repository } from './core/repository';
export { SchemaGenerator } from './core/schemaGenerator';
export { ValidationGenerator } from './utils/validation';
export { Model } from './core/model';
export type { CrudoraServerConfig } from './core/crudoraServer';

// Keep decorator exports for backward compatibility
export { Model as ModelDecorator, Field } from './decorators/model';
export type { ModelOptions, FieldOptions } from './types/model.type';
