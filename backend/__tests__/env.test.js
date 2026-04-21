const validateEnv = require('../config/env');

describe('validateEnv', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('throws when required variables are missing', () => {
    process.env = {};
    expect(() => validateEnv()).toThrow(/Missing required environment variables/);
  });

  test('returns true when required variables are present', () => {
    process.env = { MONGO_URI: 'mongodb://localhost:27017/test', JWT_SECRET: 'secret' };
    expect(validateEnv()).toBe(true);
  });
});
