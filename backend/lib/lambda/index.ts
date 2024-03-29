import { Duration } from "aws-cdk-lib";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

interface LambdaFunctionProps {
  entry: string;
  environment: { [key: string]: string };
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
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
    });
  }
}

