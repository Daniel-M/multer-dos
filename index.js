const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3')

const crypto = require('crypto')

function getFilename (req, file, cb) {
  crypto.randomBytes(16, function (err, raw) {
    cb(err, err ? undefined : raw.toString('hex'))
  })
}

function resolveOption (value, defaultFn, typeName) {
  if (typeof value === 'string') {
    return function (_req, _file, cb) { cb(null, value) }
  }
  if (typeof value === 'function') {
    return value
  }
  if (defaultFn) {
    return defaultFn
  }
  throw new TypeError(typeName + ' must be a string or a function')
}

function DigitalOceanSpaces (opts) {
  if (!opts || typeof opts !== 'object') {
    throw new TypeError('Options object is required')
  }

  this.getACL = resolveOption(
    opts.acl,
    function (_req, _file, cb) { cb(null, 'private') },
    'opts.acl'
  )

  this.getKey = resolveOption(opts.key, getFilename, 'opts.key')
  this.getBucket = resolveOption(opts.bucket, null, 'opts.bucket')

  if (opts.metadata && typeof opts.metadata === 'object') {
    this.getMetadata = function (_req, _file, cb) { cb(null, opts.metadata) }
  } else if (typeof opts.metadata === 'function') {
    this.getMetadata = opts.metadata
  } else {
    this.getMetadata = undefined
  }

  this.config = {
    endpoint: opts.endpoint,
    region: opts.region,
    credentials: {
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
    },
  }

  this.client = new S3Client(this.config)
}

DigitalOceanSpaces.prototype._handleFile = function _handleFile (req, file, cb) {
  const that = this
  const readStream = file.stream

  that.getACL(req, file, (err, ACL) => {
    if (err) { return cb(err, null) }
    that.getBucket(req, file, (err, Bucket) => {
      if (err) { return cb(err, null) }
      that.getKey(req, file, (err, Key) => {
        if (err) { return cb(err, null) }

        const body = []
        let totalLength = 0
        let settled = false

        function done (err, info) {
          if (settled) return
          settled = true
          cb(err, info)
        }

        readStream.on('data', chunk => {
          totalLength += chunk.length
          body.push(chunk)
        })

        readStream.on('error', err => {
          done(err, null)
        })

        readStream.on('end', () => {
          const Body = Buffer.concat(body, totalLength)
          const putObjectInput = {
            Body,
            ACL,
            Bucket,
            Key,
            ContentLength: totalLength,
          }

          const putObjectCmd = new PutObjectCommand(putObjectInput)
          that.client.send(putObjectCmd).then(
            putObjectRes => {
              done(null, {
                res: putObjectRes,
                location: putObjectInput.Bucket + '/' + putObjectInput.Key,
                size: totalLength,
                key: putObjectInput.Key,
                bucket: putObjectInput.Bucket,
              })
            },
            err => done(err, null)
          )
        })
      })
    })
  })
}

DigitalOceanSpaces.prototype._removeFile = function _removeFile (req, file, cb) {
  const that = this
  delete file.buffer

  that.getBucket(req, file, (err, Bucket) => {
    if (err) { return cb(err, null) }
    that.getKey(req, file, (err, Key) => {
      if (err) { return cb(err, null) }

      const deleteObjectInput = {
        Bucket,
        Key,
      }
      const deleteObjectCmd = new DeleteObjectCommand(deleteObjectInput)
      that.client.send(deleteObjectCmd).then(
        deleteObjectRes => {
          cb(null, {
            response: deleteObjectRes,
            location: deleteObjectInput.Bucket + '/' + deleteObjectInput.Key,
          })
        },
        err => cb(err, null)
      )
    })
  })
}

module.exports = function (opts) {
  return new DigitalOceanSpaces(opts)
}
