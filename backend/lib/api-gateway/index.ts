import { DomainName, EndpointType, LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { AnyPrincipal, Effect, PolicyDocument, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import config from "../config";
import { ARecord, IHostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { ApiGatewayDomain } from "aws-cdk-lib/aws-route53-targets";

interface ApiGatewayProps {
  domainCert: ICertificate;
  domainHostedZone: IHostedZone;
}

export class ApiGateway extends RestApi {
  constructor(scope: Construct, id: string, props: ApiGatewayProps) {
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
  }

  createLambdaBackedResource(resourceName: string, lambda: IFunction) {
    const apiResource = this.root.addResource(resourceName);   // creates /{resource} endpoint
    const lambdaIntegration = new LambdaIntegration(lambda, {
      allowTestInvoke: false,
    });
    apiResource.addMethod('POST', lambdaIntegration);         // C
    apiResource.addMethod('GET', lambdaIntegration);          // R
    apiResource.addMethod('PUT', lambdaIntegration);          // U
    apiResource.addMethod('DELETE', lambdaIntegration);       // D
  }
}
