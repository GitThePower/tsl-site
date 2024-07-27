import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { Api } from './api';
import config from './config';
import { DynamoDBTable } from './dynamodb';
import { CronJob } from './events';
import { LambdaFunction, LambdaRole } from './lambda';
import { S3 } from './s3';
import Website from './website';
import { ResourceLambdaEnv, FillPoolsLambdaEnv } from '../src/types';

interface TslDotComStackProps extends StackProps {
  apiKeyValue: string;
}

export class TslDotComStack extends Stack {
  constructor(scope: Construct, id: string, props: TslDotComStackProps) {
    super(scope, id, props);

    const website = new Website(this, `${id}-site`);

    const restApi = new Api(this, `${id}-api`, {
      apiKeyValue: props.apiKeyValue,
      domainCert: website.httpsCertificate,
      domainHostedZone: website.hostedZone,
    });

    const createRestfulResource = (resource: string, pk: string, extendedEnv: Record<string, string>) => {
      const table = new DynamoDBTable(this, `${id}-${resource}-table`, {
        partitionKey: {
          name: pk,
          type: AttributeType.STRING,
        },
      });
      const lambdaEnv: ResourceLambdaEnv = {
        DB_TABLE_NAME: table.tableName,
        ...extendedEnv,
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
        lambdaRole,
        table,
      };
    };

    const leagueDataBucket = new S3(this, `${id}-${config.resource_league}`.toLowerCase());
    const leagueResource = createRestfulResource(config.resource_league, config.resource_league_pk, {
      S3_BUCKET_NAME: leagueDataBucket.bucketName,
    });
    leagueDataBucket.grantReadWrite(leagueResource.lambdaRole);

    createRestfulResource(config.resource_session, config.resource_session_pk, {});

    const userResource = createRestfulResource(config.resource_user, config.resource_user_pk, {});

    const fillPoolsLambdaEnv: FillPoolsLambdaEnv = {
      LEAGUE_BUCKET_NAME: leagueDataBucket.bucketName,
      LEAGUE_TABLE_NAME: leagueResource.table.tableName,
      USER_TABLE_NAME: userResource.table.tableName,
    };
    const fillPoolsLambdaRole = new LambdaRole(this, `${id}-${config.job_fillPools}-role`);
    const fillPoolsLambda = new LambdaFunction(this, `${id}-${config.job_fillPools}-executor`, {
      entry: `src/jobs/${config.job_fillPools}.ts`,
      environment: fillPoolsLambdaEnv,
      role: fillPoolsLambdaRole,
      timeout: Duration.minutes(1),
    });
    leagueDataBucket.grantPut(fillPoolsLambdaRole);
    leagueResource.table.grantReadData(fillPoolsLambdaRole);
    userResource.table.grantReadData(fillPoolsLambdaRole);

    new CronJob(this, `${id}-${config.job_fillPools}-schedule`, {
      cronOps: {
        hour: '0',
        minute: '0',
      },
      lambda: fillPoolsLambda,
    });
  }
}
