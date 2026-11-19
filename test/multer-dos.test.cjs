const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const multerDos = require('..');

function createBaseOpts(overrides = {}) {
  return {
    bucket: 'test-bucket',
    endpoint: 'https://nyc3.digitaloceanspaces.com',
    region: 'nyc3',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    ...overrides,
  };
}

describe('multerDos constructor & options', () => {
  it('throws TypeError when options are missing or invalid', () => {
    assert.throws(() => multerDos(), TypeError);
    assert.throws(() => multerDos(null), TypeError);
    assert.throws(() => multerDos('invalid'), TypeError);
  });

  it('throws TypeError when bucket is missing or invalid', () => {
    assert.throws(
      () => multerDos(createBaseOpts({ bucket: undefined })),
      TypeError
    );
    assert.throws(
      () => multerDos(createBaseOpts({ bucket: 123 })),
      TypeError
    );
  });

  it('sets default ACL to private and generates 32-char hex key', (_, done) => {
    const storage = multerDos(createBaseOpts());
    assert.strictEqual(typeof storage.getACL, 'function');
    assert.strictEqual(typeof storage.getKey, 'function');
    assert.strictEqual(storage.getMetadata, undefined);

    storage.getACL({}, {}, (err, acl) => {
      assert.ifError(err);
      assert.strictEqual(acl, 'private');

      storage.getKey({}, {}, (keyErr, key) => {
        assert.ifError(keyErr);
        assert.match(key, /^[0-9a-f]{32}$/);
        done();
      });
    });
  });

  it('handles null metadata safely and accepts object or function metadata', (_, done) => {
    const withNull = multerDos(createBaseOpts({ metadata: null }));
    assert.strictEqual(withNull.getMetadata, undefined);

    const withObj = multerDos(createBaseOpts({ metadata: { a: '1' } }));
    withObj.getMetadata({}, {}, (err, meta) => {
      assert.ifError(err);
      assert.deepStrictEqual(meta, { a: '1' });

      const withFn = multerDos(
        createBaseOpts({ metadata: (_req, _file, cb) => cb(null, { b: '2' }) })
      );
      withFn.getMetadata({}, {}, (fnErr, fnMeta) => {
        assert.ifError(fnErr);
        assert.deepStrictEqual(fnMeta, { b: '2' });
        done();
      });
    });
  });

  it('stores S3Client config and client instance', () => {
    const storage = multerDos(createBaseOpts());
    assert.deepStrictEqual(storage.config, {
      endpoint: 'https://nyc3.digitaloceanspaces.com',
      region: 'nyc3',
      credentials: {
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      },
    });
    assert.strictEqual(typeof storage.client.send, 'function');
  });
});

describe('_handleFile', () => {
  it('buffers stream until end and sends PutObjectCommand', (_, done) => {
    const storage = multerDos(
      createBaseOpts({
        acl: 'public-read',
        key: 'uploads/hello.txt',
      })
    );

    const sentCommands = [];
    const mockRes = { ETag: '"abc123"' };
    storage.client = {
      send: async (cmd) => {
        sentCommands.push(cmd);
        return mockRes;
      },
    };

    const stream = Readable.from([Buffer.from('hello '), Buffer.from('world')]);
    storage._handleFile({}, { stream }, (err, info) => {
      assert.ifError(err);
      assert.strictEqual(sentCommands.length, 1);
      assert.ok(sentCommands[0] instanceof PutObjectCommand);
      assert.deepStrictEqual(sentCommands[0].input, {
        Body: Buffer.from('hello world'),
        ACL: 'public-read',
        Bucket: 'test-bucket',
        Key: 'uploads/hello.txt',
        ContentLength: 11,
      });
      assert.deepStrictEqual(info, {
        res: mockRes,
        location: 'test-bucket/uploads/hello.txt',
        size: 11,
        key: 'uploads/hello.txt',
        bucket: 'test-bucket',
      });
      done();
    });
  });

  it('propagates resolver errors without calling S3Client', (_, done) => {
    const expectedErr = new Error('bucket resolver failed');
    const storage = multerDos(
      createBaseOpts({
        bucket: (_req, _file, cb) => cb(expectedErr),
      })
    );

    let sendCalled = false;
    storage.client = {
      send: async () => {
        sendCalled = true;
        return {};
      },
    };

    storage._handleFile({}, { stream: Readable.from(['data']) }, (err, info) => {
      assert.strictEqual(err, expectedErr);
      assert.strictEqual(info, null);
      assert.strictEqual(sendCalled, false);
      done();
    });
  });

  it('propagates stream errors and invokes callback once', (_, done) => {
    const storage = multerDos(createBaseOpts({ key: 'k' }));
    storage.client = {
      send: async () => ({}),
    };

    const stream = new Readable({
      read() {
        process.nextTick(() => this.destroy(new Error('stream boom')));
      },
    });

    let calls = 0;
    storage._handleFile({}, { stream }, (err, info) => {
      calls += 1;
      assert.strictEqual(calls, 1);
      assert.match(err.message, /stream boom/);
      assert.strictEqual(info, null);
      done();
    });
  });

  it('propagates S3Client rejection', (_, done) => {
    const storage = multerDos(createBaseOpts({ key: 'k' }));
    const s3Err = new Error('S3 upload failed');
    storage.client = {
      send: async () => {
        throw s3Err;
      },
    };

    storage._handleFile({}, { stream: Readable.from([Buffer.from('abc')]) }, (err, info) => {
      assert.strictEqual(err, s3Err);
      assert.strictEqual(info, null);
      done();
    });
  });
});

describe('_removeFile', () => {
  it('deletes file.buffer, sends DeleteObjectCommand, and returns location', (_, done) => {
    const storage = multerDos(createBaseOpts({ key: 'uploads/hello.txt' }));
    const sentCommands = [];
    const mockRes = { DeleteMarker: true };
    storage.client = {
      send: async (cmd) => {
        sentCommands.push(cmd);
        return mockRes;
      },
    };

    const file = { buffer: Buffer.from('abc') };
    storage._removeFile({}, file, (err, info) => {
      assert.ifError(err);
      assert.strictEqual('buffer' in file, false);
      assert.strictEqual(sentCommands.length, 1);
      assert.ok(sentCommands[0] instanceof DeleteObjectCommand);
      assert.deepStrictEqual(sentCommands[0].input, {
        Bucket: 'test-bucket',
        Key: 'uploads/hello.txt',
      });
      assert.deepStrictEqual(info, {
        response: mockRes,
        location: 'test-bucket/uploads/hello.txt',
      });
      done();
    });
  });

  it('propagates S3Client rejection on delete', (_, done) => {
    const storage = multerDos(createBaseOpts({ key: 'uploads/hello.txt' }));
    const s3Err = new Error('S3 delete failed');
    storage.client = {
      send: async () => {
        throw s3Err;
      },
    };

    storage._removeFile({}, {}, (err, info) => {
      assert.strictEqual(err, s3Err);
      assert.strictEqual(info, null);
      done();
    });
  });
});
