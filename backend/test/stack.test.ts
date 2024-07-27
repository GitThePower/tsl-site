import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TslDotComStack } from '../lib/stack';

test('Stack should have the following resource counts', () => {
  const app = new cdk.App();
  const stack = new TslDotComStack(app, 'MyTestStack', {
    apiKeyValue: 'someKey',
    env: { account: '123412341234', region: 'us-east-1' },
  });
  const template = Template.fromStack(stack);


  template.resourceCountIs('AWS::ApiGateway::Method', 15);
  template.resourceCountIs('AWS::ApiGateway::Resource', 3);
  template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  template.resourceCountIs('AWS::DynamoDB::Table', 3);
  template.resourceCountIs('AWS::IAM::Policy', 5);
  template.resourceCountIs('AWS::IAM::Role', 5);
  template.resourceCountIs('AWS::Lambda::Function', 5);
  template.resourceCountIs('AWS::S3::Bucket', 2);
});
