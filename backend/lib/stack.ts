import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiGateway } from './api-gateway';
import { DynamoDBTable } from './dynamodb';
import { LambdaFunction, LambdaRole } from './lambda';
import Website from './website';
import { ResourceLambdaEnv } from '../src/types';
import config from './config';

export class TslDotComStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const website = new Website(this, `${id}-site`);

    const restApi = new ApiGateway(this, `${id}-api`, {
      domainName: {
        domainName: config.domainName,
        certificate: website.httpsCertificate,
      },
    });

    const RESOURCES = ['user', 'league'];
    RESOURCES.map(resource => {
      const table = new DynamoDBTable(this, `${id}-${resource}-table`);
      const lambdaEnv: ResourceLambdaEnv = {
        DB_TABLE_NAME: table.tableName
      };
      const lambdaRole = new LambdaRole(this, `${id}-${resource}-role`);
      const lambda = new LambdaFunction(this, `${id}-${resource}-accessor`, {
        entry: `src/${resource}/index.ts`,
        environment: lambdaEnv,
        role: lambdaRole,
      });
      table.grantFullAccess(lambdaRole);
      restApi.createLambdaBackedResource(resource, lambda);
    });
  }
}
