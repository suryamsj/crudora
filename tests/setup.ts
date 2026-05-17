import 'reflect-metadata';

/**
 * Thenable chain mimicking Drizzle's chainable query builder.
 * Constructed with a return value; every chain method returns `this`
 * so `await chain.from(t).where(x).limit(1)` resolves to the value.
 */
export class SelectChain {
  from: jest.Mock;
  where: jest.Mock;
  limit: jest.Mock;
  offset: jest.Mock;
  orderBy: jest.Mock;

  constructor(private value: any) {
    this.from = jest.fn().mockReturnValue(this);
    this.where = jest.fn().mockReturnValue(this);
    this.limit = jest.fn().mockReturnValue(this);
    this.offset = jest.fn().mockReturnValue(this);
    this.orderBy = jest.fn().mockReturnValue(this);
  }

  then<T>(
    onfulfilled?: ((value: any) => T | PromiseLike<T>) | null,
    onrejected?: ((reason: any) => T | PromiseLike<T>) | null,
  ): Promise<T> {
    return Promise.resolve(this.value).then(onfulfilled, onrejected);
  }
}

// Named sub-chain mocks so tests can assert on them individually
export const insertValuesMock = jest.fn();
export const updateSetMock = jest.fn();
export const updateWhereMock = jest.fn();
export const deleteWhereMock = jest.fn();

export const dbMock: any = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();

  insertValuesMock.mockResolvedValue(undefined);
  updateWhereMock.mockResolvedValue(undefined);
  deleteWhereMock.mockResolvedValue(undefined);
  updateSetMock.mockReturnValue({ where: updateWhereMock });

  dbMock.insert.mockReturnValue({ values: insertValuesMock });
  dbMock.update.mockReturnValue({ set: updateSetMock });
  dbMock.delete.mockReturnValue({ where: deleteWhereMock });
  // Default: select returns empty array; individual tests override with mockImplementation
  dbMock.select.mockImplementation(() => new SelectChain([]));
});

global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
