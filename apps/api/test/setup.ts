/**
 * Jest test setup file
 */

// Extend Jest matchers
expect.extend({});

// Global test timeout
jest.setTimeout(30000);

// Silence console output during tests (optional)
// Uncomment to suppress logs during test runs
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

// Clean up after all tests
afterAll(async () => {
  // Add any global cleanup here
});
