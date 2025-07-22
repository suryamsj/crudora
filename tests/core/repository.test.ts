import { Repository } from '../../src/core/repository';
import { Model, ModelConstructor } from '../../src/core/model';
import { prismaMock } from '../setup';

class TestUser extends Model {
  static tableName = 'users';
  static fillable = ['name', 'email'];
  static hidden = ['password'];

  id?: string;
  name?: string;
  email?: string;
  password?: string;
}

class TestUserWithHooks extends Model {
  static tableName = 'users';
  static fillable = ['name', 'email'];

  static async beforeCreate(data: any) {
    return { ...data, name: data.name.toUpperCase() };
  }

  static async afterCreate(data: any, result: any) {
    return { ...result, processed: true };
  }

  static async beforeUpdate(id: string, data: any) {
    return { ...data, updatedBy: 'system' };
  }

  static async afterUpdate(id: string, data: any, result: any) {
    return { ...result, lastModified: new Date() };
  }

  static async beforeDelete(id: string) {
    console.log(`Deleting user ${id}`);
  }

  static async afterDelete(id: string, result: any) {
    return { ...result, deleted: true };
  }

  static async beforeFind(options: any) {
    return { ...options, include: { profile: true } };
  }

  static async afterFind(result: any) {
    if (Array.isArray(result)) {
      return result.map(item => ({ ...item, processed: true }));
    }
    return { ...result, processed: true };
  }

  id?: string;
  name?: string;
  email?: string;
  processed?: boolean;
  lastModified?: Date;
  deleted?: boolean;
  updatedBy?: string;
}

describe('Repository', () => {
  let repository: Repository<TestUser>;
  let repositoryWithHooks: Repository<TestUserWithHooks>;

  beforeEach(() => {
    repository = new Repository(TestUser, prismaMock);
    repositoryWithHooks = new Repository(TestUserWithHooks, prismaMock);
  });

  describe('create', () => {
    it('should create a new record', async () => {
      const userData = { name: 'John Doe', email: 'john@example.com' };
      const expectedResult = { id: '1', ...userData };

      prismaMock.users.create.mockResolvedValue(expectedResult);

      const result = await repository.create(userData);

      expect(prismaMock.users.create).toHaveBeenCalledWith({
        data: userData,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true
        }
      });
      expect(result).toEqual(expectedResult);
    });

    it('should execute beforeCreate and afterCreate hooks', async () => {
      const userData = { name: 'john doe', email: 'john@example.com' };
      const expectedResult = { id: '1', name: 'JOHN DOE', email: 'john@example.com', processed: true };

      prismaMock.users.create.mockResolvedValue({ id: '1', name: 'JOHN DOE', email: 'john@example.com' });

      const result = await repositoryWithHooks.create(userData);

      expect(prismaMock.users.create).toHaveBeenCalledWith({
        data: { name: 'JOHN DOE', email: 'john@example.com' }
      });
      expect((result as any).processed).toBe(true);
    });
  });

  describe('findById', () => {
    it('should find a record by id', async () => {
      const expectedResult = { id: '1', name: 'John Doe', email: 'john@example.com' };

      prismaMock.users.findUnique.mockResolvedValue(expectedResult);

      const result = await repository.findById('1');

      expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true
        }
      });
      expect(result).toEqual(expectedResult);
    });

    it('should return null when record not found', async () => {
      prismaMock.users.findUnique.mockResolvedValue(null);

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });

    it('should execute beforeFind and afterFind hooks', async () => {
      const mockResult = { id: '1', name: 'John Doe', email: 'john@example.com' };
      prismaMock.users.findUnique.mockResolvedValue(mockResult);

      const result = await repositoryWithHooks.findById('1');

      expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { profile: true }
      });
      expect((result as any).processed).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should find all records with pagination', async () => {
      const mockResults = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Doe', email: 'jane@example.com' }
      ];

      prismaMock.users.findMany.mockResolvedValue(mockResults);

      const result = await repository.findAll({ skip: 0, take: 10 });

      expect(prismaMock.users.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true
        }
      });
      expect(result).toEqual(mockResults);
    });

    it('should execute beforeFind and afterFind hooks for findAll', async () => {
      const mockResults = [
        { id: '1', name: 'John Doe', email: 'john@example.com' }
      ];
      prismaMock.users.findMany.mockResolvedValue(mockResults);

      const result = await repositoryWithHooks.findAll();

      expect(prismaMock.users.findMany).toHaveBeenCalledWith({
        include: { profile: true }
      });
      expect((result[0] as any).processed).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a record', async () => {
      const updateData = { name: 'John Updated' };
      const expectedResult = { id: '1', name: 'John Updated', email: 'john@example.com' };

      prismaMock.users.update.mockResolvedValue(expectedResult);

      const result = await repository.update('1', updateData);

      expect(prismaMock.users.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true
        }
      });
      expect(result).toEqual(expectedResult);
    });

    it('should execute beforeUpdate and afterUpdate hooks', async () => {
      const updateData = { name: 'John Updated' };
      const mockResult = { id: '1', name: 'John Updated', updatedBy: 'system' };
      prismaMock.users.update.mockResolvedValue(mockResult);

      const result = await repositoryWithHooks.update('1', updateData);

      expect(prismaMock.users.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'John Updated', updatedBy: 'system' }
      });
      expect((result as any).lastModified).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete a record', async () => {
      const expectedResult = { id: '1', name: 'John Doe', email: 'john@example.com' };

      prismaMock.users.delete.mockResolvedValue(expectedResult);

      const result = await repository.delete('1');

      expect(prismaMock.users.delete).toHaveBeenCalledWith({
        where: { id: '1' }
      });
      expect(result).toEqual(expectedResult);
    });

    it('should execute beforeDelete and afterDelete hooks', async () => {
      const mockResult = { id: '1', name: 'John Doe' };
      prismaMock.users.delete.mockResolvedValue(mockResult);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await repositoryWithHooks.delete('1');

      expect(consoleSpy).toHaveBeenCalledWith('Deleting user 1');
      expect((result as any).deleted).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('count', () => {
    it('should count records', async () => {
      prismaMock.users.count.mockResolvedValue(5);

      const result = await repository.count();

      expect(prismaMock.users.count).toHaveBeenCalledWith({ where: undefined });
      expect(result).toBe(5);
    });

    it('should count records with where clause', async () => {
      const whereClause = { name: 'John' };
      prismaMock.users.count.mockResolvedValue(2);

      const result = await repository.count(whereClause);

      expect(prismaMock.users.count).toHaveBeenCalledWith({ where: whereClause });
      expect(result).toBe(2);
    });
  });
});
