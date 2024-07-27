import {
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  GetObjectCommand,
  GetObjectCommandInput,
  GetObjectCommandOutput,
  PutObjectCommand,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';

let _s3Client: S3Client | null;
const getS3Client = (): S3Client => {
  if (!_s3Client) {
    _s3Client = new S3Client();
  }
  return _s3Client;
};

export const deleteObject = async (input: DeleteObjectCommandInput): Promise<DeleteObjectCommandOutput> => {
  const client = getS3Client();
  return client.send(new DeleteObjectCommand(input));
};

export const getObject = async (input: GetObjectCommandInput): Promise<GetObjectCommandOutput> => {
  const client = getS3Client();
  return client.send(new GetObjectCommand(input));
};

export const putObject = async (input: PutObjectCommandInput): Promise<PutObjectCommandOutput> => {
  const client = getS3Client();
  return client.send(new PutObjectCommand(input));
};
