import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class S3 extends Bucket {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      bucketName: `${id}-bucket`,
      enforceSSL: true,
      versioned: true,
    });
  }
}
