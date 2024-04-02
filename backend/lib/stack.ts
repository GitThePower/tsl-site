import * as cdk from 'aws-cdk-lib';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { Api } from './api';
import { DynamoDBTable } from './dynamodb';
import { LambdaFunction, LambdaRole } from './lambda';
import Website from './website';
import { ResourceLambdaEnv } from '../src/types';

interface RestfulResourceProperties {
  lambda: LambdaFunction;
  table: DynamoDBTable;
}

export class TslDotComStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const website = new Website(this, `${id}-site`);

    const restApi = new Api(this, `${id}-api`, {
        domainCert: website.httpsCertificate,
        domainHostedZone: website.hostedZone,
    });

    const createRestfulResource = (resource: string): RestfulResourceProperties => {
      const table = new DynamoDBTable(this, `${id}-${resource}-table`, {
        partitionKey: {
          name: `${resource}name`,
          type: AttributeType.STRING,
        },
      });
      const lambdaEnv: ResourceLambdaEnv = {
        DB_TABLE_NAME: table.tableName,
      };
      const lambdaRole = new LambdaRole(this, `${id}-${resource}-role`);
      const lambda = new LambdaFunction(this, `${id}-${resource}-accessor`, {
        entry: `src/${resource}/index.ts`,
        environment: lambdaEnv,
        role: lambdaRole,
      });
      table.grantFullAccess(lambdaRole);
      restApi.createLambdaBackedResource(resource, lambda);
    
      return {
        lambda,
        table,
      };
    };

    createRestfulResource('league');

    createRestfulResource('user');
  }
}
