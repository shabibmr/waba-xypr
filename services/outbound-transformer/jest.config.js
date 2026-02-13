module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/index.ts',
        '!**/node_modules/**'
    ],
    coverageThreshold: {
        global: { branches: 80, functions: 80, lines: 80, statements: 80 }
    },
    testMatch: ['**/tests/**/*.test.ts'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    testTimeout: 10000,
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
    }
};
