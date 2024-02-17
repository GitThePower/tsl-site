import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import config from '../config';

export default class Website {

  public bucket: s3.IBucket;
  public cfnDistribution: cloudfront.CfnDistribution;
  public cloudFrontDistribution: cloudfront.CloudFrontWebDistribution;
  public hostedZone: route53.IHostedZone;
  public httpsCertificate: acm.ICertificate;
  public oac: cloudfront.CfnOriginAccessControl;

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
      subjectAlternativeNames: [config.domainNameWww],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
      certificateName: `${id}-cert`,
    });
    this.oac = new cloudfront.CfnOriginAccessControl(scope, `${id}-oac`, {
      originAccessControlConfig: {
        name: `Blogcloudfront.CfnOriginAccessControl`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });
    this.cloudFrontDistribution = new cloudfront.CloudFrontWebDistribution(scope, `${id}-dist`, {
      defaultRootObject: 'index.html',
      viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(this.httpsCertificate, {
        aliases: [config.domainName, config.domainNameWww],
      }),
      originConfigs: [{
        s3OriginSource: {
          s3BucketSource: this.bucket,
        },
        behaviors: [{
          isDefaultBehavior: true,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        }],
      }],
      errorConfigurations: [{
        errorCode: 403,
        responsePagePath: '/index.html',
        responseCode: 200,
        errorCachingMinTtl: 60,
      }],
    });
    this.cfnDistribution = this.cloudFrontDistribution.node.defaultChild as cloudfront.CfnDistribution;
    this.cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', this.oac.getAtt('Id'));
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
