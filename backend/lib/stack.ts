import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiGateway } from './api-gateway';
import { DynamoDBTable } from './dynamodb';
import { LambdaFunction } from './lambda';
import Website from './website';
import { ResourceLambdaEnv } from '../types';

export class TslDotComStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new Website(this, `${id}-site`);

    const restApi = new ApiGateway(this, `${id}-api`);

    const RESOURCES = ['user', 'league'];
    RESOURCES.map(resource => {
      const table = new DynamoDBTable(this, `${id}-${resource}-table`);
      const lambdaEnv: ResourceLambdaEnv = {
        DB_TABLE_NAME: table.tableName
      };
      const lambda = new LambdaFunction(this, `${id}-${resource}-accessor`, {
        entry: `src/${resource}/index.ts`,
        environment: lambdaEnv,
      });
      table.grantFullAccess(lambda);
      restApi.createLambdaBackedResource(resource, lambda);
    });
  }
}
