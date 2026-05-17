import { pgTable, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { Repository } from '../../src/core/repository';
import { Model } from '../../src/core/model';
import { HasMany, HasOne, BelongsTo, BelongsToMany } from '../../src/decorators/model';
import { Field } from '../../src/decorators/model';
import {
  dbMock,
  insertValuesMock,
  updateSetMock,
  updateWhereMock,
  deleteWhereMock,
  SelectChain,
} from '../setup';

// ─── Tables ──────────────────────────────────────────────────────────────────

const testUserTable = pgTable('users', {
  id:        text('id').primaryKey(),
  name:      varchar('name', { length: 255 }),
  email:     varchar('email', { length: 255 }),
  password:  varchar('password', { length: 255 }),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

const testPostTable = pgTable('posts', {
  id:        text('id').primaryKey(),
  title:     varchar('title', { length: 255 }),
  authorId:  text('authorId'),
  deletedAt: timestamp('deletedAt', { mode: 'date' }),
});

const testRoleTable = pgTable('roles', {
  id:   text('id').primaryKey(),
  name: varchar('name', { length: 255 }),
});

const testUserRoleTable = pgTable('user_roles', {
  id:     text('id').primaryKey(),
  userId: text('userId'),
  roleId: text('roleId'),
});

// ─── Models ───────────────────────────────────────────────────────────────────

class TestPost extends Model {
  static tableName = 'posts';
  static softDelete = true;

  @Field({ type: 'uuid', primary: true }) id!: string;
  @Field({ type: 'string' }) title!: string;
  @Field({ type: 'uuid' }) authorId!: string;
}

class TestUser extends Model {
  static tableName = 'users';
  static fillable = ['name', 'email'];
  static hidden = ['password'];

  @HasMany(() => TestPost, 'authorId')
  posts?: TestPost[];

  id?: string;
  name?: string;
  email?: string;
  password?: string;
}

class TestProfile extends Model {
  static tableName = 'profiles';
  @Field({ type: 'uuid', primary: true }) id!: string;
  @Field({ type: 'uuid' }) userId!: string;
}

class TestUserWithRelations extends Model {
  static tableName = 'users';

  @HasMany(() => TestPost, 'authorId')
  posts?: TestPost[];

  @HasOne(() => TestProfile, 'userId')
  profile?: TestProfile;

  @BelongsTo(() => TestUser, 'managerId')
  manager?: TestUser;

  id?: string;
  managerId?: string;
}

class TestRole extends Model {
  static tableName = 'roles';
  @Field({ type: 'uuid', primary: true }) id!: string;
  @Field({ type: 'string' }) name!: string;
}

class TestUserRole extends Model {
  static tableName = 'user_roles';
  @Field({ type: 'uuid', primary: true }) id!: string;
  @Field({ type: 'uuid' }) userId!: string;
  @Field({ type: 'uuid' }) roleId!: string;
}

class TestUserWithBelongsToMany extends Model {
  static tableName = 'users';

  @BelongsToMany(() => TestRole, () => TestUserRole, 'userId', 'roleId')
  roles?: TestRole[];

  id?: string;
}

class TestUserWithHooks extends Model {
  static tableName = 'users';
  static fillable = ['name', 'email'];

  static async beforeCreate(data: any) {
    return { ...data, name: data.name.toUpperCase() };
  }
  static async afterCreate(_data: any, result: any) {
    return { ...result, processed: true };
  }
  static async beforeUpdate(_id: string, data: any) {
    return { ...data, updatedBy: 'system' };
  }
  static async afterUpdate(_id: string, _data: any, result: any) {
    return { ...result, lastModified: new Date() };
  }
  static async beforeDelete(id: string) {
    console.log(`Deleting user ${id}`);
  }
  static async afterDelete(_id: string, result: any) {
    return { ...result, deleted: true };
  }
  static async beforeFind(options: any) {
    return { ...options, _touched: true };
  }
  static async afterFind(results: any[]) {
    return results.map((item) => ({ ...item, processed: true }));
  }

  id?: string; name?: string; email?: string;
  processed?: boolean; lastModified?: Date; deleted?: boolean; updatedBy?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRegistry(entries: [string, Repository<any>][]): Map<string, Repository<any>> {
  return new Map(entries);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Repository', () => {
  let repository: Repository<TestUser>;
  let repositoryWithHooks: Repository<TestUserWithHooks>;
  let softRepo: Repository<TestPost>;

  beforeEach(() => {
    repository        = new Repository(TestUser,         dbMock, testUserTable);
    repositoryWithHooks = new Repository(TestUserWithHooks, dbMock, testUserTable);
    softRepo          = new Repository(TestPost,         dbMock, testPostTable);
  });

  // ─── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create a new record', async () => {
      const userData      = { name: 'John Doe', email: 'john@example.com' };
      const expectedResult = { id: 'uuid-1', name: 'John Doe', email: 'john@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([expectedResult]));

      const result = await repository.create(userData);

      expect(dbMock.insert).toHaveBeenCalledWith(testUserTable);
      expect(insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'John Doe', email: 'john@example.com' }),
      );
      expect(result).toEqual(expectedResult);
    });

    it('should auto-generate an id when not provided', async () => {
      const userData = { name: 'Jane', email: 'jane@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([{ id: 'generated', ...userData }]));

      await repository.create(userData);

      const inserted = insertValuesMock.mock.calls[0][0];
      expect(typeof inserted.id).toBe('string');
      expect(inserted.id.length).toBeGreaterThan(0);
    });

    it('should execute beforeCreate and afterCreate hooks', async () => {
      const userData = { name: 'john doe', email: 'john@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([{ id: 'uuid-1', name: 'JOHN DOE', email: 'john@example.com' }]));

      const result = await repositoryWithHooks.create(userData);

      expect(insertValuesMock.mock.calls[0][0].name).toBe('JOHN DOE');
      expect((result as any).processed).toBe(true);
    });
  });

  // ─── findById ──────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('should find a record by id', async () => {
      const expected = { id: '1', name: 'John Doe', email: 'john@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([expected]));

      const result = await repository.findById('1');
      expect(result).toEqual(expected);
    });

    it('should return null when record not found', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([]));
      expect(await repository.findById('999')).toBeNull();
    });

    it('should select only non-hidden columns', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'John' }]));
      await repository.findById('1');

      const selectArg = dbMock.select.mock.calls[0][0];
      expect(selectArg).toBeDefined();
      expect(selectArg.password).toBeUndefined();
      expect(selectArg.id).toBeDefined();
    });

    it('should execute afterFind hook', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'John' }]));
      const result = await repositoryWithHooks.findById('1');
      expect((result as any).processed).toBe(true);
    });

    it('should respect select option', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'John' }]));
      await repository.findById('1', { select: ['id', 'name'] });

      const selectArg = dbMock.select.mock.calls[0][0];
      expect(selectArg).toBeDefined();
      expect(Object.keys(selectArg)).toEqual(expect.arrayContaining(['id', 'name']));
      expect(selectArg.email).toBeUndefined();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should find all records with pagination', async () => {
      const mockResults = [
        { id: '1', name: 'John', email: 'john@example.com' },
        { id: '2', name: 'Jane', email: 'jane@example.com' },
      ];
      dbMock.select.mockImplementation(() => new SelectChain(mockResults));

      const result = await repository.findAll({ skip: 0, take: 10 });
      expect(result).toEqual(mockResults);
    });

    it('should apply orderBy and order options', async () => {
      const chain = new SelectChain([]);
      dbMock.select.mockImplementation(() => chain);
      await repository.findAll({ orderBy: 'name', order: 'asc' });
      expect(chain.orderBy).toHaveBeenCalled();
    });

    it('should execute afterFind hook', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'John' }]));
      const result = await repositoryWithHooks.findAll();
      expect((result[0] as any).processed).toBe(true);
    });

    it('should support advanced filter operators', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([]));
      await repository.findAll({ where: { name_like: 'John', name_ne: 'Admin' } });
      expect(dbMock.select).toHaveBeenCalled();
    });

    it('should filter hidden columns via select option', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1' }]));
      await repository.findAll({ select: ['id'] });

      const selectArg = dbMock.select.mock.calls[0][0];
      expect(Object.keys(selectArg)).toContain('id');
      expect(selectArg.name).toBeUndefined();
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update a record', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'Updated' }]));
      const result = await repository.update('1', { name: 'Updated' } as any);

      expect(dbMock.update).toHaveBeenCalledWith(testUserTable);
      expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated' }));
      expect(updateWhereMock).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should auto-inject updatedAt when timestamps are enabled', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'Jane' }]));
      await repository.update('1', { name: 'Jane' } as any);
      expect(updateSetMock.mock.calls[0][0].updatedAt).toBeInstanceOf(Date);
    });

    it('should execute beforeUpdate and afterUpdate hooks', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'John', updatedBy: 'system' }]));
      const result = await repositoryWithHooks.update('1', { name: 'John' } as any);
      expect(updateSetMock.mock.calls[0][0].updatedBy).toBe('system');
      expect((result as any).lastModified).toBeDefined();
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────
  describe('delete', () => {
    it('should delete a record and return it', async () => {
      const existing = { id: '1', name: 'John', email: 'john@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([existing]));
      const result = await repository.delete('1');

      expect(dbMock.delete).toHaveBeenCalledWith(testUserTable);
      expect(deleteWhereMock).toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it('should execute beforeDelete and afterDelete hooks', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'John' }]));
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await repositoryWithHooks.delete('1');

      expect(consoleSpy).toHaveBeenCalledWith('Deleting user 1');
      expect((result as any).deleted).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  // ─── soft delete ───────────────────────────────────────────────────────────
  describe('soft delete', () => {
    it('should set deletedAt instead of hard-deleting', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', title: 'Hello' }]));
      await softRepo.delete('1');

      expect(dbMock.update).toHaveBeenCalledWith(testPostTable);
      expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }));
      expect(dbMock.delete).not.toHaveBeenCalled();
    });

    it('should hard-delete with hardDelete()', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1' }]));
      await softRepo.hardDelete('1');
      expect(dbMock.delete).toHaveBeenCalledWith(testPostTable);
    });

    it('should restore a soft-deleted record', async () => {
      const softDeleted = { id: '1', title: 'Hello', deletedAt: new Date('2024-01-01') };
      const restored = { id: '1', title: 'Hello', deletedAt: null };
      // First select: raw row check (must have deletedAt set to confirm it's soft-deleted)
      dbMock.select.mockImplementationOnce(() => new SelectChain([softDeleted]));
      // Second select: fetch after restore (returns non-deleted row)
      dbMock.select.mockImplementationOnce(() => new SelectChain([restored]));
      await softRepo.restore('1');

      expect(dbMock.update).toHaveBeenCalledWith(testPostTable);
      expect(updateSetMock).toHaveBeenCalledWith({ deletedAt: null });
    });
  });

  // ─── count ─────────────────────────────────────────────────────────────────
  describe('count', () => {
    it('should count records', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ count: 5 }]));
      expect(await repository.count()).toBe(5);
    });

    it('should count records with a where filter', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ count: 2 }]));
      expect(await repository.count({ name: 'John' })).toBe(2);
    });
  });

  // ─── Relations ─────────────────────────────────────────────────────────────
  describe('relations', () => {
    it('hasMany: loads related records via _in batch', async () => {
      const users = [{ id: 'u1', name: 'Alice' }, { id: 'u2', name: 'Bob' }];
      const posts = [
        { id: 'p1', title: 'Post A', authorId: 'u1' },
        { id: 'p2', title: 'Post B', authorId: 'u1' },
        { id: 'p3', title: 'Post C', authorId: 'u2' },
      ];

      // Build a real registry with a mock Post repo
      const postRepo = new Repository(TestPost, dbMock, testPostTable);
      const registry = makeRegistry([['TestPost', postRepo]]);
      const userRepo = new Repository(TestUser, dbMock, testUserTable, registry);

      let call = 0;
      dbMock.select.mockImplementation(() => {
        call++;
        // 1st call → findAll users, 2nd call → batch posts
        return new SelectChain(call === 1 ? users : posts);
      });

      const result = await userRepo.findAll({ with: ['posts'] });

      expect(result[0]).toMatchObject({ id: 'u1', posts: expect.arrayContaining([expect.objectContaining({ id: 'p1' })]) });
      expect(result[1]).toMatchObject({ id: 'u2', posts: [expect.objectContaining({ id: 'p3' })] });
    });

    it('hasOne: attaches a single related record or null', async () => {
      const users    = [{ id: 'u1', name: 'Alice' }];
      const profiles = [{ id: 'pr1', userId: 'u1' }];

      const profileRepo = new Repository(TestProfile, dbMock, testUserTable);
      const registry    = makeRegistry([['TestProfile', profileRepo]]);
      const repo        = new Repository(TestUserWithRelations, dbMock, testUserTable, registry);

      let call = 0;
      dbMock.select.mockImplementation(() => {
        call++;
        return new SelectChain(call === 1 ? users : profiles);
      });

      const result = await repo.findAll({ with: ['profile'] });
      expect(result[0]).toMatchObject({ id: 'u1', profile: expect.objectContaining({ id: 'pr1' }) });
    });

    it('belongsTo: attaches the owning record', async () => {
      const users    = [{ id: 'u1', name: 'Alice', managerId: 'm1' }];
      const managers = [{ id: 'm1', name: 'Boss' }];

      const managerRepo = new Repository(TestUser, dbMock, testUserTable);
      const registry    = makeRegistry([['TestUser', managerRepo]]);
      const repo        = new Repository(TestUserWithRelations, dbMock, testUserTable, registry);

      let call = 0;
      dbMock.select.mockImplementation(() => {
        call++;
        return new SelectChain(call === 1 ? users : managers);
      });

      const result = await repo.findAll({ with: ['manager'] });
      expect(result[0]).toMatchObject({ id: 'u1', manager: expect.objectContaining({ id: 'm1' }) });
    });

    it('skips unknown relation names gracefully', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1' }]));
      const result = await repository.findAll({ with: ['doesNotExist'] });
      expect(result).toHaveLength(1);
      expect((result[0] as any).doesNotExist).toBeUndefined();
    });
  });

  // ─── Cursor pagination ─────────────────────────────────────────────────────
  describe('findWithCursor', () => {
    it('returns data with nextCursor when more pages exist', async () => {
      // 11 items returned → hasMore = true, data sliced to 10
      const items = Array.from({ length: 11 }, (_, i) => ({ id: `id-${i + 1}`, name: `User ${i + 1}` }));
      dbMock.select.mockImplementation(() => new SelectChain(items));

      const result = await repository.findWithCursor({ take: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('returns null nextCursor on the last page', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ id: `id-${i + 1}`, name: `User ${i + 1}` }));
      dbMock.select.mockImplementation(() => new SelectChain(items));

      const result = await repository.findWithCursor({ take: 10 });

      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('decodes cursor and applies gt condition', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([]));
      const cursor = Buffer.from(JSON.stringify({ id: 'abc' })).toString('base64');

      await repository.findWithCursor({ take: 10, cursor });

      // where() should have been called (cursor condition was added)
      const chain = dbMock.select.mock.results[0].value as SelectChain;
      expect(chain.where).toHaveBeenCalled();
    });

    it('encodes nextCursor based on last item cursorField', async () => {
      const items = Array.from({ length: 11 }, (_, i) => ({ id: `id-${i + 1}` }));
      dbMock.select.mockImplementation(() => new SelectChain(items));

      const result = await repository.findWithCursor({ take: 10, cursorField: 'id' });

      const decoded = JSON.parse(Buffer.from(result.nextCursor!, 'base64').toString('utf-8'));
      expect(decoded).toEqual({ id: 'id-10' }); // 10th item (last in sliced data)
    });
  });

  // ─── Select query param ────────────────────────────────────────────────────
  describe('select option', () => {
    it('findById: passes only requested columns to Drizzle select', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1' }]));
      await repository.findById('1', { select: ['id'] });

      const selectArg = dbMock.select.mock.calls[0][0];
      expect(Object.keys(selectArg)).toContain('id');
      expect(selectArg.email).toBeUndefined();
    });

    it('findAll: passes only requested columns to Drizzle select', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'John' }]));
      await repository.findAll({ select: ['id', 'name'] });

      const selectArg = dbMock.select.mock.calls[0][0];
      expect(Object.keys(selectArg)).toEqual(expect.arrayContaining(['id', 'name']));
      expect(selectArg.email).toBeUndefined();
    });

    it('hidden columns are never included even if explicitly selected', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1' }]));
      await repository.findAll({ select: ['id', 'password'] });

      const selectArg = dbMock.select.mock.calls[0][0];
      expect(selectArg?.password).toBeUndefined();
    });

    it('includeHidden: findAll returns hidden columns when includeHidden=true', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'John', password: 'hash' }]));
      await repository.findAll({ includeHidden: true });

      const selectArg = dbMock.select.mock.calls[0][0];
      // When includeHidden=true and no other hidden/softDelete constraints, buildSelectCols returns undefined (select all)
      expect(selectArg).toBeUndefined();
    });

    it('includeHidden: findById returns hidden columns when includeHidden=true', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'John', password: 'hash' }]));
      await repository.findById('1', { includeHidden: true });

      const selectArg = dbMock.select.mock.calls[0][0];
      expect(selectArg).toBeUndefined();
    });

    it('includeHidden: findOne returns hidden columns when includeHidden=true', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'John', password: 'hash' }]));
      await repository.findOne({ name: 'John' }, { includeHidden: true });

      const selectArg = dbMock.select.mock.calls[0][0];
      expect(selectArg).toBeUndefined();
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('returns the first matching record', async () => {
      const record = { id: '1', name: 'Alice', email: 'alice@example.com' };
      dbMock.select.mockImplementation(() => new SelectChain([record]));

      const result = await repository.findOne({ name: 'Alice' });
      expect(result).toEqual(record);
    });

    it('returns null when no record matches', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([]));
      expect(await repository.findOne({ name: 'Ghost' })).toBeNull();
    });

    it('respects select and with options', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'Alice' }]));
      await repository.findOne({ name: 'Alice' }, { select: ['id', 'name'] });

      const selectArg = dbMock.select.mock.calls[0][0];
      expect(Object.keys(selectArg)).toContain('id');
      expect(selectArg.email).toBeUndefined();
    });
  });

  // ─── exists ────────────────────────────────────────────────────────────────
  describe('exists', () => {
    it('returns true when a record is found (SELECT pk LIMIT 1)', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ _pk: 'u1' }]));
      expect(await repository.exists({ name: 'Alice' })).toBe(true);
    });

    it('returns false when no record is found', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([]));
      expect(await repository.exists({ name: 'Ghost' })).toBe(false);
    });
  });

  // ─── createMany ────────────────────────────────────────────────────────────
  describe('createMany', () => {
    it('returns empty array for empty input', async () => {
      expect(await repository.createMany([])).toEqual([]);
      expect(dbMock.insert).not.toHaveBeenCalled();
    });

    it('inserts all records in one call and returns them', async () => {
      const records = [
        { id: 'u1', name: 'Alice', email: 'a@example.com' },
        { id: 'u2', name: 'Bob',   email: 'b@example.com' },
      ];
      dbMock.select.mockImplementation(() => new SelectChain(records));

      const result = await repository.createMany([
        { name: 'Alice', email: 'a@example.com' },
        { name: 'Bob',   email: 'b@example.com' },
      ]);

      expect(dbMock.insert).toHaveBeenCalledTimes(1);
      expect(insertValuesMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Alice' }),
          expect.objectContaining({ name: 'Bob' }),
        ]),
      );
      expect(result).toEqual(records);
    });

    it('auto-generates UUIDs for records without a pk', async () => {
      dbMock.select.mockImplementation(() => new SelectChain([{ id: 'gen', name: 'Carol' }]));
      await repository.createMany([{ name: 'Carol', email: 'c@example.com' }]);

      const inserted = insertValuesMock.mock.calls[0][0];
      expect(typeof inserted[0].id).toBe('string');
      expect(inserted[0].id.length).toBeGreaterThan(0);
    });

    it('calls afterCreateMany hook with all inserted records', async () => {
      class UserWithBatchHook extends Model {
        static tableName = 'users';
        static async afterCreateMany(records: any[]) {
          return records.map((r) => ({ ...r, batchProcessed: true }));
        }
      }
      const batchRepo = new Repository(UserWithBatchHook, dbMock, testUserTable);
      const records = [{ id: 'u1', name: 'Alice' }, { id: 'u2', name: 'Bob' }];
      dbMock.select.mockImplementation(() => new SelectChain(records));

      const result = await batchRepo.createMany([{ name: 'Alice' }, { name: 'Bob' }] as any[]);

      expect((result[0] as any).batchProcessed).toBe(true);
      expect((result[1] as any).batchProcessed).toBe(true);
    });
  });

  // ─── multiple orderBy ──────────────────────────────────────────────────────
  describe('multiple orderBy', () => {
    it('applies multiple sort columns when orderBy is an array', async () => {
      const chain = new SelectChain([]);
      dbMock.select.mockImplementation(() => chain);

      await repository.findAll({ orderBy: ['name', 'email'], order: ['asc', 'desc'] });
      expect(chain.orderBy).toHaveBeenCalled();
    });

    it('falls back to single orderBy string', async () => {
      const chain = new SelectChain([]);
      dbMock.select.mockImplementation(() => chain);

      await repository.findAll({ orderBy: 'name', order: 'asc' });
      expect(chain.orderBy).toHaveBeenCalled();
    });
  });

  // ─── withDeleted ───────────────────────────────────────────────────────────
  describe('withDeleted option', () => {
    it('findAll: skips soft-delete clause when withDeleted=true', async () => {
      const records = [
        { id: '1', title: 'Active' },
        { id: '2', title: 'Deleted', deletedAt: new Date() },
      ];
      dbMock.select.mockImplementation(() => new SelectChain(records));

      const result = await softRepo.findAll({ withDeleted: true });
      // Both records returned — no isNull(deletedAt) filter applied
      expect(result).toHaveLength(2);
    });

    it('findById: skips soft-delete clause when withDeleted=true', async () => {
      const deleted = { id: '1', title: 'Gone', deletedAt: new Date() };
      dbMock.select.mockImplementation(() => new SelectChain([deleted]));

      const result = await softRepo.findById('1', { withDeleted: true });
      expect(result).toMatchObject({ id: '1' });
    });
  });

  // ─── belongsToMany ─────────────────────────────────────────────────────────
  describe('belongsToMany', () => {
    it('loads many-to-many related records via pivot', async () => {
      const users      = [{ id: 'u1', name: 'Alice' }];
      const pivotRows  = [
        { id: 'ur1', userId: 'u1', roleId: 'r1' },
        { id: 'ur2', userId: 'u1', roleId: 'r2' },
      ];
      const roles = [
        { id: 'r1', name: 'Admin' },
        { id: 'r2', name: 'Editor' },
      ];

      const roleRepo     = new Repository(TestRole,     dbMock, testRoleTable);
      const userRoleRepo = new Repository(TestUserRole, dbMock, testUserRoleTable);
      const registry = makeRegistry([
        ['TestRole',     roleRepo],
        ['TestUserRole', userRoleRepo],
      ]);
      const repo = new Repository(TestUserWithBelongsToMany, dbMock, testUserTable, registry);

      let call = 0;
      dbMock.select.mockImplementation(() => {
        call++;
        if (call === 1) return new SelectChain(users);     // main query
        if (call === 2) return new SelectChain(pivotRows); // pivot query
        return new SelectChain(roles);                     // related query
      });

      const result = await repo.findAll({ with: ['roles'] });
      expect(result[0].roles).toHaveLength(2);
      expect(result[0].roles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'r1', name: 'Admin' }),
          expect.objectContaining({ id: 'r2', name: 'Editor' }),
        ]),
      );
    });

    it('returns empty array when no pivot rows match', async () => {
      const users = [{ id: 'u1', name: 'Alice' }];

      const roleRepo     = new Repository(TestRole,     dbMock, testRoleTable);
      const userRoleRepo = new Repository(TestUserRole, dbMock, testUserRoleTable);
      const registry = makeRegistry([
        ['TestRole',     roleRepo],
        ['TestUserRole', userRoleRepo],
      ]);
      const repo = new Repository(TestUserWithBelongsToMany, dbMock, testUserTable, registry);

      let call = 0;
      dbMock.select.mockImplementation(() => {
        call++;
        if (call === 1) return new SelectChain(users);
        return new SelectChain([]);  // empty pivot
      });

      const result = await repo.findAll({ with: ['roles'] });
      expect(result[0].roles).toEqual([]);
    });
  });

  // ─── transaction ───────────────────────────────────────────────────────────
  describe('transaction', () => {
    it('calls db.transaction and passes a Repository to the callback', async () => {
      dbMock.transaction = jest.fn().mockImplementation(async (fn: any) => {
        return fn(dbMock);
      });
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '1', name: 'Alice' }]));

      let receivedRepo: any;
      await repository.transaction(async (trx) => {
        receivedRepo = trx;
        return trx.findById('1');
      });

      expect(dbMock.transaction).toHaveBeenCalled();
      expect(receivedRepo).toBeInstanceOf(Repository);
    });

    it('propagates the return value from the callback', async () => {
      dbMock.transaction = jest.fn().mockImplementation(async (fn: any) => fn(dbMock));
      dbMock.select.mockImplementation(() => new SelectChain([{ id: '42', name: 'Bob' }]));

      const result = await repository.transaction((trx) => trx.findById('42'));
      expect(result).toMatchObject({ id: '42' });
    });
  });
});
