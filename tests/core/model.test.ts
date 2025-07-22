import { Model } from '../../src/core/model';

class TestUser extends Model {
  static tableName = 'users';
  static primaryKey = 'id';
  static timestamps = true;
  static fillable = ['name', 'email'];
  static hidden = ['password'];
}

class TestPost extends Model {
  // No static properties - should use defaults
}

describe('Model', () => {
  describe('getTableName', () => {
    it('should return custom table name when provided', () => {
      expect(TestUser.getTableName()).toBe('users');
    });

    it('should return default table name when not provided', () => {
      expect(TestPost.getTableName()).toBe('testposts');
    });
  });

  describe('getPrimaryKey', () => {
    it('should return custom primary key when provided', () => {
      expect(TestUser.getPrimaryKey()).toBe('id');
    });

    it('should return default primary key when not provided', () => {
      expect(TestPost.getPrimaryKey()).toBe('id');
    });
  });

  describe('static properties', () => {
    it('should have correct static properties for TestUser', () => {
      expect(TestUser.tableName).toBe('users');
      expect(TestUser.primaryKey).toBe('id');
      expect(TestUser.timestamps).toBe(true);
      expect(TestUser.fillable).toEqual(['name', 'email']);
      expect(TestUser.hidden).toEqual(['password']);
    });

    it('should have default values for TestPost', () => {
      expect(TestPost.tableName).toBeUndefined();
      expect(TestPost.primaryKey).toBe('id');
      expect(TestPost.timestamps).toBe(true);
    });
  });
});