const assert = require('assert');
const multerDos = require('..');

assert.strictEqual(typeof multerDos, 'function', 'default export should be a factory function');

const storage = multerDos({
  bucket: 'test-bucket',
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  region: 'nyc3',
  accessKeyId: 'test-key',
  secretAccessKey: 'test-secret',
});

assert.strictEqual(typeof storage._handleFile, 'function');
assert.strictEqual(typeof storage._removeFile, 'function');
assert.strictEqual(typeof storage.getACL, 'function');
assert.strictEqual(typeof storage.getBucket, 'function');
assert.strictEqual(typeof storage.getKey, 'function');
assert.deepStrictEqual(storage.config, {
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  region: 'nyc3',
  credentials: {
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
  },
});

console.log('Smoke test passed');
