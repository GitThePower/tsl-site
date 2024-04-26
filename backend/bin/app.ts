#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { config } from '../../local-config';
import { TslDotComStack } from '../lib/stack';

const { apiKeyValue, awsAccountNumber, awsRegion } = config;
const app = new cdk.App();
new TslDotComStack(app, 'tsl-dot-com', {
  apiKeyValue,
  env: { account: awsAccountNumber, region: awsRegion },
});
