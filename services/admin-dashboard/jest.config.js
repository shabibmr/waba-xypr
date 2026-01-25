module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/main.jsx', '!**/node_modules/**'],
    coverageThreshold: {
        global: { branches: 80, functions: 80, lines: 80, statements: 80 }
    },
    testMatch: ['**/tests/**/*.test.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testTimeout: 10000
};
