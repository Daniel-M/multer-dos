import type { StorageEngine } from 'multer';
import multerDos from '..';

const storageMinimal: StorageEngine = multerDos({
  bucket: 'my-space',
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  region: 'nyc3',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
});

const storageWithResolvers: StorageEngine = multerDos({
  acl: (_req, _file, cb) => cb(null, 'public-read'),
  bucket: (_req, _file, cb) => cb(null, 'dynamic-space'),
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  region: 'nyc3',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  key: (_req, file, cb) => cb(null, `uploads/${file.originalname}`),
  metadata: { fieldName: 'avatar' },
});

const storageWithTypedOptions: multerDos.DigitalOceanSpaces = multerDos({
  acl: 'private',
  bucket: 'my-space',
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  region: 'nyc3',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  metadata: (_req, file, cb) => cb(null, { fieldName: file.fieldname }),
});

// @ts-expect-error bucket is required
multerDos({
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  region: 'nyc3',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
});

void storageMinimal;
void storageWithResolvers;
void storageWithTypedOptions;
