import { Model } from '../../src/core/model';

class TestUser extends Model {
  static tableName = 'users';
  static primaryKey = 'id';
  static fillable = ['name', 'email', 'age'];
  static hidden = ['password', 'secret'];
  static timestamps = true;

  id?: string;
  name?: string;
  email?: string;
  age?: number;
  password?: string;
  secret?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class TestProduct extends Model {
  static fillable = ['title', 'price'];

  id?: string;
  title?: string;
  price?: number;
}

describe('Model', () => {
  describe('getTableName', () => {
    it('should return custom table name when defined', () => {
      expect(TestUser.getTableName()).toBe('users');
    });

    it('should return pluralized class name when no table name defined', () => {
      expect(TestProduct.getTableName()).toBe('testproducts');
    });
  });

  describe('getPrimaryKey', () => {
    it('should return custom primary key when defined', () => {
      expect(TestUser.getPrimaryKey()).toBe('id');
    });

    it('should return default id when no primary key defined', () => {
      expect(TestProduct.getPrimaryKey()).toBe('id');
    });
  });

  describe('softDelete property', () => {
    class SoftModel extends Model {
      static tableName = 'soft_items';
      static softDelete = true;
    }

    it('should be false by default', () => {
      expect(TestUser.softDelete).toBe(false);
    });

    it('should be overrideable to true', () => {
      expect(SoftModel.softDelete).toBe(true);
    });
  });

  describe('static schema property', () => {
    class SchemaBoundModel extends Model {
      static schema = 'auth';
      static tableName = 'tokens';
    }

    it('should expose schema name', () => {
      expect((SchemaBoundModel as any).schema).toBe('auth');
    });

    it('should be undefined when not set', () => {
      expect((TestUser as any).schema).toBeUndefined();
    });
  });

  describe('lifecycle hooks', () => {
    it('should have default beforeCreate hook that returns data unchanged', async () => {
      const data = { name: 'Test' };
      expect(await TestUser.beforeCreate!(data)).toEqual(data);
    });

    it('should have default afterCreate hook that returns result unchanged', async () => {
      const result = { id: '1', name: 'Test' };
      expect(await TestUser.afterCreate!({ name: 'Test' }, result)).toEqual(result);
    });

    it('should have default beforeUpdate hook that returns data unchanged', async () => {
      const data = { name: 'Updated' };
      expect(await TestUser.beforeUpdate!('1', data)).toEqual(data);
    });

    it('should have default afterUpdate hook that returns result unchanged', async () => {
      const result = { id: '1', name: 'Updated' };
      expect(await TestUser.afterUpdate!('1', {}, result)).toEqual(result);
    });

    it('should have default beforeDelete hook that resolves undefined', async () => {
      await expect(TestUser.beforeDelete!('1')).resolves.toBeUndefined();
    });

    it('should have default afterDelete hook that returns result unchanged', async () => {
      const result = { id: '1', name: 'Deleted' };
      expect(await TestUser.afterDelete!('1', result)).toEqual(result);
    });

    it('should have default beforeFind hook that returns options unchanged', async () => {
      const options = { where: { id: '1' } };
      expect(await TestUser.beforeFind!(options)).toEqual(options);
    });

    it('should have default afterFind hook that returns results unchanged', async () => {
      const results = [{ id: '1', name: 'Found' }];
      expect(await TestUser.afterFind!(results)).toEqual(results);
    });
  });
});
