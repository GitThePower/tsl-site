import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';
import {
  FillPoolsLambdaEnv,
  ProcessCardCountsLambdaEnv,
  ProcessCardPoolLambdaEnv,
  ProcessDeckColorsLambdaEnv,
  ResourceLambdaEnv,
} from '../src/types';
import { Api } from './api';
import config from './config';
import { DynamoDBTable } from './dynamodb';
import { CronJob } from './events';
import { LambdaFunction, LambdaRole } from './lambda';
import { S3 } from './s3';
import Website from './website';

interface TslDotComStackProps extends StackProps {
  apiKeyValues: string[];
}

export class TslDotComStack extends Stack {
  constructor(scope: Construct, id: string, props: TslDotComStackProps) {
    super(scope, id, props);

    const website = new Website(this, `${id}-site`);

    const restApi = new Api(this, `${id}-api`, {
      apiKeyValues: props.apiKeyValues,
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
        entry: path.join(__dirname, '..', 'src', 'resources', `${resource}.ts`),
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

    const gatewaySecret = new Secret(this, `${id}-gateway-secret`, {
      secretName: config.gateway_secret_name,
    });

    const fillPoolsLambdaEnv: FillPoolsLambdaEnv = {
      GATEWAY_PROVIDER: 'scraperapi',
      GATEWAY_SECRET_NAME: config.gateway_secret_name,
      LEAGUE_BUCKET_NAME: leagueDataBucket.bucketName,
      LEAGUE_TABLE_NAME: leagueResource.table.tableName,
      REQUEST_DELAY_MS: '2500',
      USER_TABLE_NAME: userResource.table.tableName,
    };
    const fillPoolsLambdaRole = new LambdaRole(this, `${id}-${config.job_fillPools}-role`);
    const fillPoolsLambda = new LambdaFunction(this, `${id}-${config.job_fillPools}-executor`, {
      entry: path.join(__dirname, '..', 'src', 'jobs', `${config.job_fillPools}.ts`),
      environment: fillPoolsLambdaEnv,
      role: fillPoolsLambdaRole,
      timeout: Duration.minutes(5),
    });
    leagueDataBucket.grantPut(fillPoolsLambdaRole);
    leagueResource.table.grantReadWriteData(fillPoolsLambdaRole);
    userResource.table.grantReadData(fillPoolsLambdaRole);
    gatewaySecret.grantRead(fillPoolsLambdaRole);

    new CronJob(this, `${id}-${config.job_fillPools}-schedule`, {
      cronOps: {
        hour: '0',
        minute: '0',
        weekDay: 'SUN,MON,WED,FRI',
      },
      lambda: fillPoolsLambda,
    });

    const processCardPoolLambdaEnv: ProcessCardPoolLambdaEnv = {
      LEAGUE_BUCKET_NAME: leagueDataBucket.bucketName,
      LEAGUE_TABLE_NAME: leagueResource.table.tableName,
    };
    const processCardPoolLambdaRole = new LambdaRole(this, `${id}-${config.job_processCardPool}-role`);
    const processCardPoolLambda = new LambdaFunction(this, `${id}-${config.job_processCardPool}-executor`, {
      entry: path.join(__dirname, '..', 'src', 'jobs', `${config.job_processCardPool}.ts`),
      environment: processCardPoolLambdaEnv,
      role: processCardPoolLambdaRole,
      timeout: Duration.minutes(1),
    });
    leagueDataBucket.grantReadWrite(processCardPoolLambdaRole);
    leagueResource.table.grantWriteData(processCardPoolLambdaRole);

    leagueDataBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(processCardPoolLambda),
      {
        prefix: 'raw/',
        suffix: '.json',
      },
    );

    const processDeckColorsLambdaEnv: ProcessDeckColorsLambdaEnv = {
      LEAGUE_BUCKET_NAME: leagueDataBucket.bucketName,
      LEAGUE_TABLE_NAME: leagueResource.table.tableName,
    };
    const processDeckColorsLambdaRole = new LambdaRole(this, `${id}-${config.job_processDeckColors}-role`);
    const processDeckColorsLambda = new LambdaFunction(this, `${id}-${config.job_processDeckColors}-executor`, {
      entry: path.join(__dirname, '..', 'src', 'jobs', `${config.job_processDeckColors}.ts`),
      environment: processDeckColorsLambdaEnv,
      role: processDeckColorsLambdaRole,
      timeout: Duration.minutes(1),
    });
    leagueDataBucket.grantReadWrite(processDeckColorsLambdaRole);
    leagueResource.table.grantWriteData(processDeckColorsLambdaRole);

    leagueDataBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(processDeckColorsLambda),
      {
        prefix: 'card-pools/',
      },
    );

    const processCardCountsLambdaEnv: ProcessCardCountsLambdaEnv = {
      LEAGUE_BUCKET_NAME: leagueDataBucket.bucketName,
      LEAGUE_TABLE_NAME: leagueResource.table.tableName,
    };
    const processCardCountsLambdaRole = new LambdaRole(this, `${id}-${config.job_processCardCounts}-role`);
    const processCardCountsLambda = new LambdaFunction(this, `${id}-${config.job_processCardCounts}-executor`, {
      entry: path.join(__dirname, '..', 'src', 'jobs', `${config.job_processCardCounts}.ts`),
      environment: processCardCountsLambdaEnv,
      role: processCardCountsLambdaRole,
      timeout: Duration.minutes(1),
    });
    leagueDataBucket.grantReadWrite(processCardCountsLambdaRole);
    leagueResource.table.grantReadWriteData(processCardCountsLambdaRole);

    leagueDataBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(processCardCountsLambda),
      {
        prefix: 'pools/',
      },
    );
  }
}

