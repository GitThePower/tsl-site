#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { config } from '../local-config';
import { TslSiteStack } from '../lib/tsl-site-stack';

const { awsAccountNumber, awsRegion } = config;
const app = new cdk.App();
new TslSiteStack(app, 'TslSiteStack', {
  env: { account: awsAccountNumber, region: awsRegion },
});
