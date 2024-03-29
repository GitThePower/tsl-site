import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class DynamoDBTable extends Table {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: `id`, type: AttributeType.STRING },
      tableName: id
    });
  }
}
