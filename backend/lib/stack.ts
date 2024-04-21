import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { Api } from './api';
import config from './config';
import { DynamoDBTable } from './dynamodb';
import { CronJob } from './events';
import { LambdaFunction, LambdaRole } from './lambda';
import Website from './website';
import { ResourceLambdaEnv, UpdatePoolsLambdaEnv } from '../src/types';

interface RestfulResourceProperties {
  lambda: LambdaFunction;
  table: DynamoDBTable;
}

export class TslDotComStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const website = new Website(this, `${id}-site`);

    const restApi = new Api(this, `${id}-api`, {
        domainCert: website.httpsCertificate,
        domainHostedZone: website.hostedZone,
    });

    const createRestfulResource = (resource: string, pk: string): RestfulResourceProperties => {
      const table = new DynamoDBTable(this, `${id}-${resource}-table`, {
        partitionKey: {
          name: pk,
          type: AttributeType.STRING,
        },
      });
      const lambdaEnv: ResourceLambdaEnv = {
        DB_TABLE_NAME: table.tableName,
      };
      const lambdaRole = new LambdaRole(this, `${id}-${resource}-role`);
      const lambda = new LambdaFunction(this, `${id}-${resource}-accessor`, {
        entry: `src/resources/${resource}.ts`,
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

    const leagueResource = createRestfulResource(config.resource_league, config.resource_league_pk);

    createRestfulResource(config.resource_session, config.resource_session_pk);

    const userResource = createRestfulResource(config.resource_user, config.resource_user_pk);

    const updatePoolsLambdaEnv: UpdatePoolsLambdaEnv = {
      LEAGUE_TABLE_NAME: leagueResource.table.tableName,
      USER_TABLE_NAME: userResource.table.tableName,
    };
    const updatePoolsLambdaRole = new LambdaRole(this, `${id}-${config.job_updatePools}-role`);
    const updatePoolsLambda = new LambdaFunction(this, `${id}-${config.job_updatePools}-executor`, {
      entry: `src/jobs/${config.job_updatePools}.ts`,
      environment: updatePoolsLambdaEnv,
      role: updatePoolsLambdaRole,
      timeout: Duration.minutes(1),
    });
    leagueResource.table.grantReadWriteData(updatePoolsLambdaRole);
    userResource.table.grantReadData(updatePoolsLambdaRole);

    new CronJob(this, `${id}-${config.job_updatePools}-schedule`, {
      cronOps: {
        hour: '0',
        minute: '0',
      },
      lambda: updatePoolsLambda,
    });
  }
}
