import { PrismaClient } from '@prisma/client';
import { Repository } from '../../src/core/repository';
import { Model } from '../../src/core/model';

class TestUser extends Model {
  static tableName = 'user';
  id!: string;
  name!: string;
  email!: string;
}

describe('Repository', () => {
  let prisma: jest.Mocked<PrismaClient>;
  let repository: Repository<TestUser>;
  let mockUserModel: any;

  beforeEach(() => {
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockUserModel = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };
    (prisma as any).user = mockUserModel;
    repository = new Repository(TestUser, prisma);
  });

  describe('create', () => {
    it('should create a new record', async () => {
      const userData = { name: 'John Doe', email: 'john@example.com' };
      const expectedUser = { id: '1', ...userData };
      mockUserModel.create.mockResolvedValue(expectedUser);

      const result = await repository.create(userData);

      expect(mockUserModel.create).toHaveBeenCalledWith({ data: userData });
      expect(result).toEqual(expectedUser);
    });
  });

  describe('findById', () => {
    it('should find a record by id', async () => {
      const expectedUser = { id: '1', name: 'John Doe', email: 'john@example.com' };
      mockUserModel.findUnique.mockResolvedValue(expectedUser);

      const result = await repository.findById('1');

      expect(mockUserModel.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(expectedUser);
    });

    it('should return null when record not found', async () => {
      mockUserModel.findUnique.mockResolvedValue(null);

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all records without options', async () => {
      const expectedUsers = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Doe', email: 'jane@example.com' }
      ];
      mockUserModel.findMany.mockResolvedValue(expectedUsers);

      const result = await repository.findAll();

      expect(mockUserModel.findMany).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(expectedUsers);
    });

    it('should find all records with pagination options', async () => {
      const options = { skip: 10, take: 5, where: { name: 'John' } };
      const expectedUsers = [{ id: '1', name: 'John Doe', email: 'john@example.com' }];
      mockUserModel.findMany.mockResolvedValue(expectedUsers);

      const result = await repository.findAll(options);

      expect(mockUserModel.findMany).toHaveBeenCalledWith(options);
      expect(result).toEqual(expectedUsers);
    });
  });

  describe('update', () => {
    it('should update a record', async () => {
      const updateData = { name: 'John Updated' };
      const expectedUser = { id: '1', name: 'John Updated', email: 'john@example.com' };
      mockUserModel.update.mockResolvedValue(expectedUser);

      const result = await repository.update('1', updateData);

      expect(mockUserModel.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData
      });
      expect(result).toEqual(expectedUser);
    });
  });

  describe('delete', () => {
    it('should delete a record', async () => {
      const expectedUser = { id: '1', name: 'John Doe', email: 'john@example.com' };
      mockUserModel.delete.mockResolvedValue(expectedUser);

      const result = await repository.delete('1');

      expect(mockUserModel.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(expectedUser);
    });
  });

  describe('count', () => {
    it('should count records without filter', async () => {
      mockUserModel.count.mockResolvedValue(5);

      const result = await repository.count();

      expect(mockUserModel.count).toHaveBeenCalledWith({ where: undefined });
      expect(result).toBe(5);
    });

    it('should count records with filter', async () => {
      const where = { name: 'John' };
      mockUserModel.count.mockResolvedValue(2);

      const result = await repository.count(where);

      expect(mockUserModel.count).toHaveBeenCalledWith({ where });
      expect(result).toBe(2);
    });
  });
});