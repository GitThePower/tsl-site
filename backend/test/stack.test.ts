import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TslDotComStack } from '../lib/stack';

test('Stack should have the following resource counts', () => {
  const app = new cdk.App();
  const stack = new TslDotComStack(app, 'MyTestStack', {
    env: { account: '123412341234', region: 'us-east-1' },
  });
  const template = Template.fromStack(stack);


  template.resourceCountIs('AWS::ApiGateway::Method', 10);
  template.resourceCountIs('AWS::ApiGateway::Resource', 2);
  template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  template.resourceCountIs('AWS::DynamoDB::Table', 2);
  template.resourceCountIs('AWS::IAM::Policy', 3);
  template.resourceCountIs('AWS::IAM::Role', 3);
  template.resourceCountIs('AWS::Lambda::Function', 3);
  template.resourceCountIs('AWS::S3::Bucket', 1);
});
