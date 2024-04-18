import { Duration } from 'aws-cdk-lib';
import { IRole, ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

interface LambdaFunctionProps {
  entry: string;
  environment: { [key:string]: string};
  role: IRole;
}

export class LambdaRole extends Role {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      roleName: id,
    });
    this.addManagedPolicy(  // Add the Lambda Basic Execution Policy to the Role
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole',
      ),
    );
  }
}

export class LambdaFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props: LambdaFunctionProps) {
    super(scope, id, {
      architecture: Architecture.ARM_64,
      depsLockFilePath: 'package-lock.json',
      entry: props.entry,
      environment: props.environment,
      functionName: id,
      handler: 'handler',
      memorySize: 128,
      retryAttempts: 0,
      role: props.role,
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
    });
  }
}

