# Multer DOS

## Intro

This is an adaptation of the multer-s3 plugin to work with Digital Ocean Spaces.

## How to use it

The options are the same as the ones in [multer documentation](https://www.npmjs.com/package/multer). To use the plugin just import the module and create a custom storage 
object to be passed as the `storage` option of `multer` like in the example below,

```js
const path = require('path')
const express = require('express')
const multer  = require('multer')
const multerDos = require('multer-dos')

// Customize the options just as with multer-s3
const storage = multerDos(({
  acl: process.env.DO_SPACES_BUCKET_ACL_POLICY,
  bucket: process.env.DO_SPACES_BUCKET_NAME,
  endpoint: process.env.DO_SPACES_ENDPOINT,
  region: process.env.DO_SPACES_REGION,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  key: function(req, file, cb) {
      let dir = path.join(process.env.DO_SPACES_BASE_PATH, ...req.url.split('/'))

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
      const nameParts = file.originalname.split('.')
      const ext = nameParts.pop()

      const fileDest = file.originalname + '-' + uniqueSuffix + '.' + ext
      const key = path.join(dir, fileDest)
      cb(null, key)
    }
  }))


// Load the custom storage into multer
const upload = multer({ storage })

const app = express()

app.post('/profile', upload.single('avatar'), function (req, res, next) {
  // req.file is the `avatar` file
  // req.body will hold the text fields, if there were any
})

app.post('/photos/upload', upload.array('photos', 12), function (req, res, next) {
  // req.files is array of `photos` files
  // req.body will contain the text fields, if there were any
})

const cpUpload = upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'gallery', maxCount: 8 }])
app.post('/cool-profile', cpUpload, function (req, res, next) {
  // req.files is an object (String -> Array) where fieldname is the key, and the value is array of files
  //
  // e.g.
  //  req.files['avatar'][0] -> File
  //  req.files['gallery'] -> Array
  //
  // req.body will contain the text fields, if there were any
})
```

and thats about it. I've deployed this to production and has been running for almost a year without any issues whatsoever.

## Want to give feedback?

Create issues at [github](https://github.com/Daniel-M/multer-dos) they are welcome
