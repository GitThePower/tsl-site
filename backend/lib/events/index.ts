import { CronOptions, Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

interface CronJobProps {
  cronOps: CronOptions;
  lambda: IFunction;
}

export class CronJob extends Rule {

  constructor(scope: Construct, id: string, props: CronJobProps) {
    super(scope, id, {
      enabled: true,
      ruleName: id,
      schedule: Schedule.cron(props.cronOps),
     });
    this.addTarget(new LambdaFunction(props.lambda));
  }
}