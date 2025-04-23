import { DomainName, EndpointType, IApiKey, IResource, IUsagePlan, LambdaIntegration, Period, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { AnyPrincipal, Effect, PolicyDocument, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { ARecord, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayDomain } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import config from '../config';

interface ApiProps {
  apiKeyValues: string[];
  domainCert: ICertificate;
  domainHostedZone: IHostedZone;
}

export class Api extends RestApi {

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id, {
      cloudWatchRole: false,
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ['*'],
            effect: Effect.ALLOW,
            principals: [new AnyPrincipal()],
            resources: ['*']
          })
        ]
      }),
      restApiName: id
    });
    // Create the custom domain name with subdomain
    const customDomain = new DomainName(scope, `${id}-api-custom-domain`, {
      certificate: props.domainCert,
      domainName: config.domainNameApi,
      endpointType: EndpointType.REGIONAL,
    });
    // Create API mapping
    customDomain.addBasePathMapping(this, {
      basePath: '',
      stage: this.deploymentStage,
    });
    // Create Route 53 Record to point to the subdomain 
    new ARecord(scope, `${id}-api-custom-domain-aRecord`, {
      recordName: config.domainNameApi,
      target: RecordTarget.fromAlias(new ApiGatewayDomain(customDomain)),
      zone: props.domainHostedZone,
    });

    const usagePlan = this.addUsagePlan(`${id}-api-usage-plan`, {
      apiStages: [
        {
          stage: this.deploymentStage,
        }
      ],
      quota: {
        limit: 5000000,
        period: Period.MONTH,
      },
      throttle: {
        burstLimit: 2,
        rateLimit: 10,
      },
    });

    props.apiKeyValues.forEach((apiKeyValue, idx) => {
      const apiKeyName = `${id}-api-key-${idx}`;
      const apiKey = this.addApiKey(apiKeyName, {
        apiKeyName,
        value: apiKeyValue,
      });
      usagePlan.addApiKey(apiKey);
    });
  }

  createLambdaBackedResource(resourceName: string, lambda: IFunction): IResource {
    const resource = this.root.addResource(resourceName);   // creates /{resource} endpoint
    const lambdaIntegration = new LambdaIntegration(lambda, {
      allowTestInvoke: false,
    });
    resource.addMethod('POST', lambdaIntegration, {         // C
      apiKeyRequired: true,
    });
    resource.addMethod('GET', lambdaIntegration, {          // R
      apiKeyRequired: true,
    });
    resource.addMethod('PUT', lambdaIntegration, {          // U
      apiKeyRequired: true,
    });
    resource.addMethod('DELETE', lambdaIntegration, {       // D
      apiKeyRequired: true,
    });
    resource.addCorsPreflight({
      allowOrigins: [`https://${config.domainName}`, `https://${config.domainNameWww}`],
      allowMethods: ['POST', 'GET', 'PUT', 'DELETE'],
    });

    return resource;
  }
}
