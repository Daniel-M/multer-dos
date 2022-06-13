const { 
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3")

const crypto = require('crypto')

function getFilename (req, file, cb) {
  crypto.randomBytes(16, function (err, raw) {
    cb(err, err ? undefined : raw.toString('hex'))
  })
}

function DigitalOceanSpaces (opts) {

  if (typeof opts.acl === 'string') {
    this.getACL = function ($0, $1, cb) { cb(null, opts.acl) }
  } else {
    this.getACL = opts.acl || function ($0, $1, cb) { cb(null, 'private') }
  }

  if (typeof opts.key === 'string') {
    this.getKey = function ($0, $1, cb) { cb(null, opts.key) }
  } else {
    this.getKey = (opts.key || getFilename)
  }

  if (typeof opts.bucket === 'string') {
    this.getBucket = function ($0, $1, cb) { cb(null, opts.bucket) }
  } else {
    this.getBucket = opts.bucket
  }

  if (typeof opts.metadata === 'object') {
    this.getMetadata = function ($0, $1, cb) { cb(null, opts.metadata) }
  } else {
    this.getMetadata = opts.metadata
  }

  const s3ClientConfig = {
    endpoint: opts.endpoint,
    region: opts.region,
    credentials: {
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
    }
  }

  this.config = s3ClientConfig
}

DigitalOceanSpaces.prototype._handleFile = function _handleFile (req, file, cb) {
  const that = this
  const readStream = file.stream 

  that.getACL(req, file, (err, ACL) => {
    if(err) { return cb(err, null) }
    that.getBucket(req, file, (err, Bucket) => {
      if(err) { return cb(err, null) }
      that.getKey(req, file, (err, Key) => {
        if(err) { return cb(err, null) }
        const body = []
        let totalLength = 0
        readStream.on('data', chunk => {
          totalLength = totalLength + chunk.length
          body.push(chunk)
        })

        const Body = Buffer.concat(body, totalLength)

        const putObjectInput = {
          Body,
          ACL,
          Bucket,
          Key,
          // Metadata,
          ContentLength: totalLength,
        }

        const putObjectCmd = new PutObjectCommand(putObjectInput)
        const client = new S3Client(that.config)
        client.send(putObjectCmd).then(putObjectRes => {
          cb(
            null,
            {
              res: putObjectRes,
              location: that.Bucket + "/" + that.Key,
              size: totalLength,
            }
          )}).catch(cb)
      })
    })
  })
}

DigitalOceanSpaces.prototype._removeFile = function _removeFile (req, file, cb) {
  const that = this
  delete file.buffer

  that.getBucket(req, file, (err, Bucket) => {
    if(err) { return cb(err, null) }
    that.getKey(req, file, (err, Key) => {
      if(err) { return cb(err, null) }
      const deleteObjectInput = {
        Bucket,
        Key,
      }
      const deleteObjectCmd = new DeleteObjectCommand(deleteObjectInput)
      const client = new S3Client(that.config)
      client.send(deleteObjectCmd, cb).then(deleteObjectRes => {
        cb(
          null,
          {
            response: deleteObjectRes,
            location: that.Bucket + "/" + that.Key,
          }
        )}).catch(cb)
    })
  })
}

module.exports = function (opts) {
  return new DigitalOceanSpaces(opts)
}