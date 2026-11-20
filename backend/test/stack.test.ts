import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TslDotComStack } from '../lib/stack';

describe('TslDotComStack', () => {
  test('Stack should have expected resource counts and authorizer method configuration', () => {
    const app = new cdk.App();
    const stack = new TslDotComStack(app, 'MyTestStack', {
      apiKeyValues: ['someKey'],
      env: { account: '123412341234', region: 'us-east-1' },
    });
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::ApiGateway::Authorizer', 1);
    template.resourceCountIs('AWS::ApiGateway::GatewayResponse', 2);
    template.resourceCountIs('AWS::ApiGateway::Method', 15);
    template.resourceCountIs('AWS::ApiGateway::Resource', 3);
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.resourceCountIs('AWS::DynamoDB::Table', 3);
    template.resourceCountIs('AWS::IAM::Policy', 10);
    template.resourceCountIs('AWS::IAM::Role', 10);
    template.resourceCountIs('AWS::Lambda::Function', 10);
    template.resourceCountIs('AWS::S3::Bucket', 2);
    template.resourceCountIs('Custom::S3BucketNotifications', 1);

    const methods = Object.values(template.findResources('AWS::ApiGateway::Method'));
    const customAuthMethods = methods.filter(
      (method) => method.Properties?.AuthorizationType === 'CUSTOM',
    );
    const openAuthMethods = methods.filter(
      (method) => method.Properties?.AuthorizationType === 'NONE',
    );
    expect(customAuthMethods).toHaveLength(8);
    expect(openAuthMethods).toHaveLength(7);

    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      AuthorizerResultTtlInSeconds: 0,
      IdentitySource: 'method.request.header.X-Api-Key',
      Type: 'REQUEST',
    });

    const authFn = Object.values(template.findResources('AWS::Lambda::Function')).find(
      (fn) => fn.Properties?.FunctionName === 'MyTestStack-authorizer-executor',
    );
    expect(authFn?.Properties?.Environment?.Variables?.ADMIN_API_KEY).toBeUndefined();
  });

  test('Stack sets ADMIN_API_KEY only when multiple API keys are provided', () => {
    const app = new cdk.App();
    const stack = new TslDotComStack(app, 'MultiKeyStack', {
      apiKeyValues: ['adminKey', 'frontendKey'],
      env: { account: '123412341234', region: 'us-east-1' },
    });
    const template = Template.fromStack(stack);

    const authFn = Object.values(template.findResources('AWS::Lambda::Function')).find(
      (fn) => fn.Properties?.FunctionName === 'MultiKeyStack-authorizer-executor',
    );
    expect(authFn?.Properties?.Environment?.Variables?.ADMIN_API_KEY).toBe('adminKey');
  });
});
