/** @type {import('ts-jest').ProjectConfigTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testEnvironmentOptions: {},
  setupFiles: ['dotenv/config'],
  reporters: ['default', 'jest-junit', 'github-actions'],
  verbose: true,
};
