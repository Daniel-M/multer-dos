import type {
  DeleteObjectCommandOutput,
  ObjectCannedACL,
  PutObjectCommandOutput,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';

declare function multerDos(opts: multerDos.Options): multerDos.DigitalOceanSpaces;

declare namespace multerDos {
  /**
   * Minimal structural representation of an Express/Multer file so these
   * declarations work both with and without `@types/multer` installed.
   */
  interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    stream: NodeJS.ReadableStream;
    destination?: string;
    filename?: string;
    path?: string;
    buffer?: Buffer;
  }

  /**
   * Callback-style resolver used for `acl`, `key`, `bucket`, and `metadata`.
   */
  type ValueResolver<T = string> = (
    req: any,
    file: MulterFile,
    cb: (err: any, value?: T) => void
  ) => void;

  interface Options {
    /** Target DigitalOcean Space (bucket) name or resolver function. */
    bucket: string | ValueResolver<string>;
    /** DigitalOcean Spaces endpoint URL (e.g. `https://nyc3.digitaloceanspaces.com`). */
    endpoint: string;
    /** DigitalOcean Spaces region (e.g. `nyc3`). */
    region: string;
    /** DigitalOcean Spaces access key ID. */
    accessKeyId: string;
    /** DigitalOcean Spaces secret access key. */
    secretAccessKey: string;
    /** Canned ACL string or resolver function. Defaults to `'private'`. */
    acl?: ObjectCannedACL | string | ValueResolver<ObjectCannedACL | string>;
    /** Object key string or resolver function. Defaults to a random 16-byte hex string. */
    key?: string | ValueResolver<string>;
    /** Object metadata map or resolver function. */
    metadata?: Record<string, string> | ValueResolver<Record<string, string>>;
  }

  interface UploadedFileInfo {
    res: PutObjectCommandOutput;
    location: string;
    size: number;
    key: string;
    bucket: string;
  }

  interface RemovedFileInfo {
    response: DeleteObjectCommandOutput;
    location: string;
  }

  class DigitalOceanSpaces {
    constructor(opts: Options);
    getACL: ValueResolver<ObjectCannedACL | string>;
    getKey: ValueResolver<string>;
    getBucket: ValueResolver<string>;
    getMetadata: ValueResolver<Record<string, string>> | undefined;
    config: S3ClientConfig;
    client: S3Client;

    _handleFile(
      req: any,
      file: MulterFile,
      cb: (err?: any, info?: UploadedFileInfo) => void
    ): void;

    _removeFile(
      req: any,
      file: MulterFile,
      cb: (err: any, info?: RemovedFileInfo) => void
    ): void;
  }
}

export = multerDos;
