import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import config from '../config';

export default class Website {

  public bucket: s3.IBucket;
  public cloudFrontDistribution: cloudfront.Distribution;
  public hostedZone: route53.IHostedZone;
  public httpsCertificate: acm.ICertificate;
  public oac: cloudfront.IOriginAccessControl;

  constructor(scope: Construct, id: string) {
    this.bucket = new s3.Bucket(scope, `${id}-bucket`, {
      websiteIndexDocument: 'index.html',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `${id}-bucket`.toLowerCase(),
    });
    this.hostedZone = route53.HostedZone.fromLookup(
      scope, `${id}-hostedzone`, { domainName: config.domainName },
    );
    this.httpsCertificate = new acm.Certificate(scope, `${id}-cert`, {
      domainName: config.domainName,
      subjectAlternativeNames: [
        config.domainNameApi,
        config.domainNameWww,
      ],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
      certificateName: `${id}-cert`,
    });
    this.oac = new cloudfront.S3OriginAccessControl(scope, `${id}-oac`, {
      originAccessControlName: `${id}-oac`,
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    });
    this.cloudFrontDistribution = new cloudfront.Distribution(scope, `${id}-dist`, {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
          originAccessControl: this.oac
        }
      ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      certificate: this.httpsCertificate,
      defaultRootObject: 'index.html',
      domainNames: [config.domainName, config.domainNameWww],
      errorResponses: [{
        httpStatus: 403,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: cdk.Duration.seconds(60),
      }],
    });
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [`${this.bucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${this.cloudFrontDistribution.distributionId}`,
          },
        },
      }),
    );
    new route53.ARecord(scope, `${id}-aRecord`, {
      zone: this.hostedZone,
      target: route53.RecordTarget.fromAlias(new CloudFrontTarget(this.cloudFrontDistribution)),
      recordName: config.domainName,
    });
    new s3deploy.BucketDeployment(scope, `bucketDeploy-${id}`, {
      sources: [s3deploy.Source.asset('../frontend/dist')],
      destinationBucket: this.bucket,
      distributionPaths: ['/*'],
      distribution: this.cloudFrontDistribution,
    });
  }
}
