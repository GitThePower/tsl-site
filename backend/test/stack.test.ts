import * as assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CloudAssembly } from 'aws-cdk-lib/cx-api';
import { TslDotComStack } from '../lib/stack';

describe('TslDotComStack', () => {
  after(() => {
    if (!process.env.CDK_NO_CLEAN_TESTS) {
      CloudAssembly.cleanupTemporaryDirectories();
    }
  });

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
    assert.equal(customAuthMethods.length, 8);
    assert.equal(openAuthMethods.length, 7);

    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      AuthorizerResultTtlInSeconds: 0,
      IdentitySource: 'method.request.header.X-Api-Key',
      Type: 'REQUEST',
    });

    const lambdaFns = Object.values(template.findResources('AWS::Lambda::Function'));
    const appLambdas = lambdaFns.filter(
      (fn) => typeof fn.Properties?.FunctionName === 'string' && fn.Properties.FunctionName.startsWith('MyTestStack-'),
    );
    assert.equal(appLambdas.length, 8);
    for (const fn of appLambdas) {
      assert.equal(fn.Properties?.Runtime, 'nodejs24.x');
    }

    const authFn = lambdaFns.find(
      (fn) => fn.Properties?.FunctionName === 'MyTestStack-authorizer-executor',
    );
    assert.equal(authFn?.Properties?.Environment?.Variables?.ADMIN_API_KEY, undefined);
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
    assert.equal(authFn?.Properties?.Environment?.Variables?.ADMIN_API_KEY, 'adminKey');
  });
});
