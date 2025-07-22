import { Model, ModelConstructor } from '../../src/core/model';

// Test Model class
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

  describe('getSelectObject', () => {
    it('should return undefined when no hidden fields', () => {
      expect(TestProduct.getSelectObject()).toBeUndefined();
    });

    it('should return select object with fillable fields excluding hidden', () => {
      const selectObject = TestUser.getSelectObject();
      
      expect(selectObject).toEqual({
        id: true,
        name: true,
        email: true,
        age: true,
        createdAt: true,
        updatedAt: true
      });
    });

    it('should exclude hidden fields from select object', () => {
      const selectObject = TestUser.getSelectObject();
      
      expect(selectObject.password).toBeUndefined();
      expect(selectObject.secret).toBeUndefined();
    });
  });

  describe('lifecycle hooks', () => {
    it('should have default beforeCreate hook that returns data unchanged', async () => {
      const data = { name: 'Test' };
      const result = await TestUser.beforeCreate!(data);
      expect(result).toEqual(data);
    });

    it('should have default afterCreate hook that returns result unchanged', async () => {
      const data = { name: 'Test' };
      const result = { id: '1', name: 'Test' };
      const hookResult = await TestUser.afterCreate!(data, result);
      expect(hookResult).toEqual(result);
    });

    it('should have default beforeUpdate hook that returns data unchanged', async () => {
      const data = { name: 'Updated' };
      const result = await TestUser.beforeUpdate!('1', data);
      expect(result).toEqual(data);
    });

    it('should have default afterUpdate hook that returns result unchanged', async () => {
      const data = { name: 'Updated' };
      const result = { id: '1', name: 'Updated' };
      const hookResult = await TestUser.afterUpdate!('1', data, result);
      expect(hookResult).toEqual(result);
    });

    it('should have default beforeDelete hook that does nothing', async () => {
      await expect(TestUser.beforeDelete!('1')).resolves.toBeUndefined();
    });

    it('should have default afterDelete hook that returns result unchanged', async () => {
      const result = { id: '1', name: 'Deleted' };
      const hookResult = await TestUser.afterDelete!('1', result);
      expect(hookResult).toEqual(result);
    });

    it('should have default beforeFind hook that returns options unchanged', async () => {
      const options = { where: { id: '1' } };
      const result = await TestUser.beforeFind!(options);
      expect(result).toEqual(options);
    });

    it('should have default afterFind hook that returns result unchanged', async () => {
      const result = { id: '1', name: 'Found' };
      const hookResult = await TestUser.afterFind!(result);
      expect(hookResult).toEqual(result);
    });
  });
});