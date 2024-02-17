import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import Website from './website';

export class TslDotComStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new Website(this, `${id}-site`);
  }
}
