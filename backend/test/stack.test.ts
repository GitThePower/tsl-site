import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TslDotComStack } from '../lib/stack';

test('Stack should have the following resource counts', () => {
  const app = new cdk.App();
  const stack = new TslDotComStack(app, 'MyTestStack', {
    env: { account: '123412341234', region: 'us-east-1' },
  });
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::S3::Bucket', 1);
});
