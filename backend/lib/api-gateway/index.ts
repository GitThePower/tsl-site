import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { AnyPrincipal, Effect, PolicyDocument, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export class ApiGateway extends RestApi {
  constructor(scope: Construct, id: string) {
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
  }

  createLambdaBackedResource(resourceName: string, lambda: IFunction) {
    const apiResource = this.root.addResource(resourceName);   // creates /{resource} endpoint
    const lambdaIntegration = new LambdaIntegration(lambda);
    apiResource.addMethod('POST', lambdaIntegration);         // C
    apiResource.addMethod('GET', lambdaIntegration);          // R
    apiResource.addMethod('PUT', lambdaIntegration);          // U
    apiResource.addMethod('DELETE', lambdaIntegration);       // D
  }
}
