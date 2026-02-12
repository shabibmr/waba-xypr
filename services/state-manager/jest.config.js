module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/index.ts',
        '!src/**/*.d.ts'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 85,
            lines: 85,
            statements: 85
        }
    },
    testMatch: [
        '**/tests/**/*.test.ts',
        '**/tests/**/*.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    testTimeout: 10000,
    moduleNameMapper: {
        '^../../../../shared/constants$': '<rootDir>/tests/mocks/shared-constants.mock'
    }
};
