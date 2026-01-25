// Mock PostgreSQL Pool for testing
class PoolMock {
    constructor() {
        this.queryResults = [];
        this.queryError = null;
    }

    // Mock query method
    async query(text, params) {
        if (this.queryError) {
            throw this.queryError;
        }

        // Return mocked result
        if (this.queryResults.length > 0) {
            return this.queryResults.shift();
        }

        // Default empty result
        return { rows: [], rowCount: 0 };
    }

    // Helper methods for tests
    mockQueryResult(result) {
        this.queryResults.push(result);
    }

    mockQueryError(error) {
        this.queryError = error;
    }

    reset() {
        this.queryResults = [];
        this.queryError = null;
    }

    async connect() {
        return {
            query: this.query.bind(this),
            release: jest.fn()
        };
    }

    async end() {
        // Mock cleanup
    }
}

module.exports = PoolMock;
