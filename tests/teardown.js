/**
 * Global test teardown
 * Cleans up mocks and connections after all tests
 */

const nock = require('nock');

module.exports = async () => {
    // Clean up all nock interceptors
    nock.cleanAll();
    nock.restore();

    console.log('Test environment cleaned up');
};
