/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transformIgnorePatterns: ['/node_modules/(?!jose|jwks-rsa)/'],
  testPathIgnorePatterns: ['/node_modules/'],
};