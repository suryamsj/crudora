import 'reflect-metadata';
import {
  Model as ModelDecorator,
  Field,
  getModelMetadata,
  getFieldMetadata,
} from '../../src/decorators/model';

// ─── @Model decorator ────────────────────────────────────────────────────────

@ModelDecorator({ tableName: 'accounts', timestamps: true })
class Account {
  name!: string;
}

@ModelDecorator()
class DefaultMeta {
  name!: string;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('decorators/model', () => {
  describe('@Model() class decorator', () => {
    it('stores tableName from options', () => {
      const meta = getModelMetadata(Account);
      expect(meta.tableName).toBe('accounts');
    });

    it('stores timestamps from options', () => {
      const meta = getModelMetadata(Account);
      expect(meta.timestamps).toBe(true);
    });

    it('falls back to lowercased class name when tableName omitted', () => {
      const meta = getModelMetadata(DefaultMeta);
      expect(meta.tableName).toBe('defaultmeta');
    });

    it('stores the constructor reference', () => {
      const meta = getModelMetadata(Account);
      expect(meta.constructor).toBe(Account);
    });
  });

  describe('getModelMetadata()', () => {
    it('returns undefined for an undecorated class', () => {
      class Plain {}
      expect(getModelMetadata(Plain)).toBeUndefined();
    });
  });

  describe('@Field() — new TC39 decorator syntax branch', () => {
    it('stores field metadata when context is an object (new syntax)', () => {
      class Target {
        myField!: string;
      }

      const decorator = Field({ type: 'string', required: true });
      // Simulate new-style decorator call (context is an object, not a string)
      decorator(Target.prototype, { name: 'myField', kind: 'field' } as any);

      const meta = getFieldMetadata(Target);
      expect(meta.myField).toBeDefined();
      expect(meta.myField.type).toBe('string');
      expect(meta.myField.required).toBe(true);
    });
  });
});
