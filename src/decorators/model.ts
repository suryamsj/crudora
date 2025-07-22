import 'reflect-metadata';
import { FieldOptions, ModelOptions } from '../types/model.type';

const MODEL_METADATA_KEY = Symbol('model');
const FIELD_METADATA_KEY = Symbol('field');

export function Model(options: ModelOptions = {}) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    Reflect.defineMetadata(MODEL_METADATA_KEY, {
      tableName: options.tableName || constructor.name.toLowerCase(),
      timestamps: options.timestamps !== false,
      constructor
    }, constructor);
    return constructor;
  };
}

export function Field(options: FieldOptions) {
  return function (target: any, context: any) {
    // Support both old and new decorator syntax
    if (typeof context === 'string') {
      // Old decorator syntax (target, propertyKey)
      const propertyKey = context;
      const existingFields = Reflect.getMetadata(FIELD_METADATA_KEY, target.constructor) || {};
      existingFields[propertyKey] = options;
      Reflect.defineMetadata(FIELD_METADATA_KEY, existingFields, target.constructor);
    } else {
      // New decorator syntax (target, context)
      const propertyKey = context.name;
      const constructor = target.constructor;
      const existingFields = Reflect.getMetadata(FIELD_METADATA_KEY, constructor) || {};
      existingFields[propertyKey] = options;
      Reflect.defineMetadata(FIELD_METADATA_KEY, existingFields, constructor);
    }
  };
}

export function getModelMetadata(target: any) {
  return Reflect.getMetadata(MODEL_METADATA_KEY, target);
}

export function getFieldMetadata(target: any) {
  return Reflect.getMetadata(FIELD_METADATA_KEY, target) || {};
}
