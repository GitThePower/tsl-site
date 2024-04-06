import { Attribute, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

interface DynamoDBTableProps {
  partitionKey: Attribute;
}

export class DynamoDBTable extends Table {
  constructor(scope: Construct, id: string, props: DynamoDBTableProps) {
    super(scope, id, {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: props.partitionKey,
      tableName: id
    });
  }
}
