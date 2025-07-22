import { Model, Field, getModelMetadata, getFieldMetadata } from '../../src/decorators/model';

@Model({ tableName: 'test_users', timestamps: true })
class TestDecoratorUser {
  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true })
  name!: string;

  @Field({ type: 'string', unique: true })
  email!: string;

  @Field({ type: 'number', required: false })
  age?: number;
}

@Model()
class TestDefaultModel {
  @Field({ type: 'string' })
  title!: string;
}

describe('Model Decorators', () => {
  describe('@Model decorator', () => {
    it('should store model metadata with custom options', () => {
      const metadata = getModelMetadata(TestDecoratorUser);

      expect(metadata).toBeDefined();
      expect(metadata.tableName).toBe('test_users');
      expect(metadata.timestamps).toBe(true);
      expect(metadata.constructor).toBe(TestDecoratorUser);
    });

    it('should store model metadata with default options', () => {
      const metadata = getModelMetadata(TestDefaultModel);

      expect(metadata).toBeDefined();
      expect(metadata.tableName).toBe('testdefaultmodel');
      expect(metadata.timestamps).toBe(true);
    });
  });

  describe('@Field decorator', () => {
    it('should store field metadata', () => {
      const fieldMetadata = getFieldMetadata(TestDecoratorUser);

      expect(fieldMetadata).toBeDefined();
      expect(fieldMetadata.id).toEqual({ type: 'uuid', primary: true });
      expect(fieldMetadata.name).toEqual({ type: 'string', required: true });
      expect(fieldMetadata.email).toEqual({ type: 'string', unique: true });
      expect(fieldMetadata.age).toEqual({ type: 'number', required: false });
    });

    it('should handle multiple fields correctly', () => {
      const fieldMetadata = getFieldMetadata(TestDecoratorUser);
      const fieldNames = Object.keys(fieldMetadata);

      expect(fieldNames).toHaveLength(4);
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('age');
    });
  });

  describe('getModelMetadata', () => {
    it('should return undefined for non-decorated class', () => {
      class NonDecoratedClass {}
      const metadata = getModelMetadata(NonDecoratedClass);
      expect(metadata).toBeUndefined();
    });
  });

  describe('getFieldMetadata', () => {
    it('should return empty object for class without field decorators', () => {
      class NoFieldsClass {}
      const fieldMetadata = getFieldMetadata(NoFieldsClass);
      expect(fieldMetadata).toEqual({});
    });
  });
});
