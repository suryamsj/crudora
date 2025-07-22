import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Create a more specific mock type that includes the models
type MockPrismaClient = DeepMockProxy<PrismaClient> & {
  users: {
    create: jest.MockedFunction<any>;
    findUnique: jest.MockedFunction<any>;
    findMany: jest.MockedFunction<any>;
    update: jest.MockedFunction<any>;
    delete: jest.MockedFunction<any>;
    count: jest.MockedFunction<any>;
  };
  products: {
    create: jest.MockedFunction<any>;
    findUnique: jest.MockedFunction<any>;
    findMany: jest.MockedFunction<any>;
    update: jest.MockedFunction<any>;
    delete: jest.MockedFunction<any>;
    count: jest.MockedFunction<any>;
  };
};

// Mock PrismaClient with proper model methods
export const prismaMock = mockDeep<PrismaClient>() as MockPrismaClient;

// Reset mocks before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// Global test utilities
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};