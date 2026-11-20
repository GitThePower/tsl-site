import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { IdentitySource, RequestAuthorizer } from 'aws-cdk-lib/aws-apigateway';
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
  SessionLambdaEnv,
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

    const createResourceTable = (resource: string, pk: string) => {
      return new DynamoDBTable(this, `${id}-${resource}-table`, {
        partitionKey: {
          name: pk,
          type: AttributeType.STRING,
        },
      });
    };

    const leagueDataBucket = new S3(this, `${id}-${config.resource_league}`.toLowerCase());
    const leagueTable = createResourceTable(config.resource_league, config.resource_league_pk);
    const sessionTable = createResourceTable(config.resource_session, config.resource_session_pk);
    const userTable = createResourceTable(config.resource_user, config.resource_user_pk);

    const authorizerLambdaRole = new LambdaRole(this, `${id}-${config.authorizer}-role`);
    const authorizerLambdaEnv: Record<string, string> = {
      SESSION_TABLE_NAME: sessionTable.tableName,
      USER_TABLE_NAME: userTable.tableName,
      ...(props.apiKeyValues.length > 1 ? { ADMIN_API_KEY: props.apiKeyValues[0] } : {}),
    };
    const authorizerLambda = new LambdaFunction(this, `${id}-${config.authorizer}-executor`, {
      entry: path.join(__dirname, '..', 'src', 'authorizer', 'index.ts'),
      environment: authorizerLambdaEnv,
      role: authorizerLambdaRole,
    });
    sessionTable.grantReadData(authorizerLambdaRole);
    userTable.grantReadData(authorizerLambdaRole);

    const requestAuthorizer = new RequestAuthorizer(this, `${id}-request-authorizer`, {
      handler: authorizerLambda,
      identitySources: [IdentitySource.header('X-Api-Key')],
      resultsCacheTtl: Duration.seconds(0),
    });

    const leagueLambdaEnv: ResourceLambdaEnv = {
      DB_TABLE_NAME: leagueTable.tableName,
      S3_BUCKET_NAME: leagueDataBucket.bucketName,
    };
    const leagueLambdaRole = new LambdaRole(this, `${id}-${config.resource_league}-role`);
    const leagueLambda = new LambdaFunction(this, `${id}-${config.resource_league}-accessor`, {
      entry: path.join(__dirname, '..', 'src', 'resources', `${config.resource_league}.ts`),
      environment: leagueLambdaEnv,
      role: leagueLambdaRole,
    });
    leagueTable.grantFullAccess(leagueLambdaRole);
    leagueDataBucket.grantReadWrite(leagueLambdaRole);
    restApi.createLambdaBackedResource(config.resource_league, leagueLambda, {
      DELETE: requestAuthorizer,
      POST: requestAuthorizer,
      PUT: requestAuthorizer,
    });

    const sessionLambdaEnv: SessionLambdaEnv = {
      DB_TABLE_NAME: sessionTable.tableName,
      USER_TABLE_NAME: userTable.tableName,
    };
    const sessionLambdaRole = new LambdaRole(this, `${id}-${config.resource_session}-role`);
    const sessionLambda = new LambdaFunction(this, `${id}-${config.resource_session}-accessor`, {
      entry: path.join(__dirname, '..', 'src', 'resources', `${config.resource_session}.ts`),
      environment: sessionLambdaEnv,
      role: sessionLambdaRole,
    });
    sessionTable.grantFullAccess(sessionLambdaRole);
    userTable.grantReadWriteData(sessionLambdaRole);
    restApi.createLambdaBackedResource(config.resource_session, sessionLambda, {
      DELETE: requestAuthorizer,
      PUT: requestAuthorizer,
    });

    const userLambdaEnv: ResourceLambdaEnv = {
      DB_TABLE_NAME: userTable.tableName,
    };
    const userLambdaRole = new LambdaRole(this, `${id}-${config.resource_user}-role`);
    const userLambda = new LambdaFunction(this, `${id}-${config.resource_user}-accessor`, {
      entry: path.join(__dirname, '..', 'src', 'resources', `${config.resource_user}.ts`),
      environment: userLambdaEnv,
      role: userLambdaRole,
    });
    userTable.grantFullAccess(userLambdaRole);
    restApi.createLambdaBackedResource(config.resource_user, userLambda, {
      DELETE: requestAuthorizer,
      POST: requestAuthorizer,
      PUT: requestAuthorizer,
    });

    const gatewaySecret = new Secret(this, `${id}-gateway-secret`, {
      secretName: config.gateway_secret_name,
    });

    const fillPoolsLambdaEnv: FillPoolsLambdaEnv = {
      GATEWAY_PROVIDER: 'scraperapi',
      GATEWAY_SECRET_NAME: config.gateway_secret_name,
      LEAGUE_BUCKET_NAME: leagueDataBucket.bucketName,
      LEAGUE_TABLE_NAME: leagueTable.tableName,
      REQUEST_DELAY_MS: '2500',
      USER_TABLE_NAME: userTable.tableName,
    };
    const fillPoolsLambdaRole = new LambdaRole(this, `${id}-${config.job_fillPools}-role`);
    const fillPoolsLambda = new LambdaFunction(this, `${id}-${config.job_fillPools}-executor`, {
      entry: path.join(__dirname, '..', 'src', 'jobs', `${config.job_fillPools}.ts`),
      environment: fillPoolsLambdaEnv,
      role: fillPoolsLambdaRole,
      timeout: Duration.minutes(5),
    });
    leagueDataBucket.grantPut(fillPoolsLambdaRole);
    leagueTable.grantReadWriteData(fillPoolsLambdaRole);
    userTable.grantReadData(fillPoolsLambdaRole);
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
      LEAGUE_TABLE_NAME: leagueTable.tableName,
    };
    const processCardPoolLambdaRole = new LambdaRole(this, `${id}-${config.job_processCardPool}-role`);
    const processCardPoolLambda = new LambdaFunction(this, `${id}-${config.job_processCardPool}-executor`, {
      entry: path.join(__dirname, '..', 'src', 'jobs', `${config.job_processCardPool}.ts`),
      environment: processCardPoolLambdaEnv,
      role: processCardPoolLambdaRole,
      timeout: Duration.minutes(1),
    });
    leagueDataBucket.grantReadWrite(processCardPoolLambdaRole);
    leagueTable.grantWriteData(processCardPoolLambdaRole);

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
      LEAGUE_TABLE_NAME: leagueTable.tableName,
    };
    const processDeckColorsLambdaRole = new LambdaRole(this, `${id}-${config.job_processDeckColors}-role`);
    const processDeckColorsLambda = new LambdaFunction(this, `${id}-${config.job_processDeckColors}-executor`, {
      entry: path.join(__dirname, '..', 'src', 'jobs', `${config.job_processDeckColors}.ts`),
      environment: processDeckColorsLambdaEnv,
      role: processDeckColorsLambdaRole,
      timeout: Duration.minutes(1),
    });
    leagueDataBucket.grantReadWrite(processDeckColorsLambdaRole);
    leagueTable.grantWriteData(processDeckColorsLambdaRole);

    leagueDataBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(processDeckColorsLambda),
      {
        prefix: 'card-pools/',
      },
    );

    const processCardCountsLambdaEnv: ProcessCardCountsLambdaEnv = {
      LEAGUE_BUCKET_NAME: leagueDataBucket.bucketName,
      LEAGUE_TABLE_NAME: leagueTable.tableName,
    };
    const processCardCountsLambdaRole = new LambdaRole(this, `${id}-${config.job_processCardCounts}-role`);
    const processCardCountsLambda = new LambdaFunction(this, `${id}-${config.job_processCardCounts}-executor`, {
      entry: path.join(__dirname, '..', 'src', 'jobs', `${config.job_processCardCounts}.ts`),
      environment: processCardCountsLambdaEnv,
      role: processCardCountsLambdaRole,
      timeout: Duration.minutes(1),
    });
    leagueDataBucket.grantReadWrite(processCardCountsLambdaRole);
    leagueTable.grantReadWriteData(processCardCountsLambdaRole);

    leagueDataBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(processCardCountsLambda),
      {
        prefix: 'pools/',
      },
    );
  }
}
