import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/tests/unit/**/*.spec.ts',
    '**/tests/integration/**/*.spec.ts',
    '**/src/**/*.spec.ts',
  ],
  // Excluir explícitamente los tests E2E de Playwright — deben correr con 'npx playwright test'
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/e2e/',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        module: 'CommonJS',
        target: 'ES2020',
        baseUrl: '.',
        paths: {
          '@/*': ['src/*'],
        },
      },
    }],
  },
};

export default config;
