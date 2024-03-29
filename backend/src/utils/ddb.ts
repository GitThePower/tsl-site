import { DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand, ReturnValue, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ZodError, ZodObject, ZodRawShape } from "zod";
import { ResourceLambdaEnvSchema } from "../../types";

let _dynamoDbClient: DynamoDBClient | null;
const getDdbClient = (): DynamoDBClient => {
  if (!_dynamoDbClient) {
    _dynamoDbClient = new DynamoDBClient();
  }
  return _dynamoDbClient;
};

// **Create (Put)**
export const createItem = async (tableName: string, item: Record<string, any>): Promise<void> => {
  const params = {
    TableName: tableName,
    Item: marshall(item)
  };
  try {
    const client = getDdbClient();
    await client.send(new PutItemCommand(params));
  } catch (err) {
    console.error("Error adding item:", err);
  }
};

// **Read (Get)**
export const getItem = async (tableName: string, key: Record<string, any>): Promise<Record<string, any>> => {
  const params = {
    TableName: tableName,
    Key: marshall(key),
  };
  let result: Record<string, any> = {};
  try {
    const client = getDdbClient();
    const { Item } = await client.send(new GetItemCommand(params));
    if (Item) {
      result = unmarshall(Item);
    }
  } catch (err) {
    console.error("Error retrieving item:", err);
  }
  return result;
};

// **Update**
export const updateItem = async (tableName: string, key: Record<string, any>, update: Record<string, any>): Promise<Record<string, any>> => {
  let UpdateExpression = 'SET';
  Object.keys(update).map((key) => {
    UpdateExpression = UpdateExpression + ` ${key} = :${key},`;
  });
  UpdateExpression = UpdateExpression.slice(0, -1);

  const expressionAttributeValues = Object.keys(update).reduce((prev: Record<string, any>, curr: string) => {
    prev[`:${curr}`] = update[curr];
    return prev;
  }, {} as Record<string, any>);
  const ExpressionAttributeValues = marshall(expressionAttributeValues);

  const params = {
    TableName: tableName,
    Key: marshall(key),
    UpdateExpression,
    ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW' as ReturnValue,
  };
  let result: Record<string, any> = {};
  try {
    const client = getDdbClient();
    const { Attributes } = await client.send(new UpdateItemCommand(params));
    if (Attributes) {
      result = unmarshall(Attributes);
    }
  } catch (err) {
    console.error("Error updating item:", err);
  }
  return result;
};

// **Delete**
export const deleteItem = async (tableName: string, key: Record<string, any>): Promise<Record<string, any>> => {
  const params = {
    TableName: tableName,
    Key: marshall(key),
  };
  let result: Record<string, any> = {};
  try {
    const client = getDdbClient();
    const { Attributes } = await client.send(new DeleteItemCommand(params));
    if (Attributes) {
      result = unmarshall(Attributes);
    }
  } catch (err) {
    console.error("Error deleting item:", err);
  }
  return result;
};

// **Scan (List)**
export const listItems = async (tableName: string): Promise<Record<string, any>[]> => {
  const params = {
    TableName: tableName,
  };
  let results: Record<string, any>[] = [];
  try {
    const client = getDdbClient();
    const { Items } = await client.send(new ScanCommand(params));
    if (Items) {
      results = Items.map((item) => unmarshall(item));
    }
  } catch (err) {
    console.error("Error listing items:", err);
  }
  return results;
};

export const ddbCrudHandler = async (event: APIGatewayProxyEvent, itemSchema: ZodObject<ZodRawShape>): Promise<APIGatewayProxyResult> => {
  const result = {
    statusCode: 500,
    body: 'Internal Error',
  };
  try {
    const { body, httpMethod, queryStringParameters } = event;
    const { DB_TABLE_NAME } = ResourceLambdaEnvSchema.parse(process.env);
    const validBody = itemSchema.safeParse(body);
    const validQueryStringParams = itemSchema.safeParse(queryStringParameters);
    if (!validBody.success || !validQueryStringParams.success) {
      const bodyErr: ZodError | boolean = (!validBody.success) ? validBody.error : false;
      const queryStringParametersErr: ZodError | boolean = (!validQueryStringParams.success) ? validQueryStringParams.error : false;
      const errMsg = `BodyErr: ${bodyErr}\nQueryStringParametersErr: ${queryStringParametersErr}`;
      result.statusCode = 400;
      result.body = errMsg;
      throw new Error(errMsg);
    }
  
    if (httpMethod === 'GET') {
      const item = await getItem(DB_TABLE_NAME, validQueryStringParams.data);
      if (Object.keys(item).length > 0) {
        result.statusCode = 200;
        result.body = JSON.stringify(item);
      } else {
        result.statusCode = 404;
        result.body = 'Item not found';
      }
    } else if (httpMethod === 'POST') {
      await createItem(DB_TABLE_NAME, validBody.data);
      result.statusCode = 200;
      result.body = 'Successfully created item!';
    } else if (httpMethod === 'PUT') {
      const update = await updateItem(DB_TABLE_NAME, validQueryStringParams.data, validBody.data);
      if (Object.keys(update).length > 0) {
        result.statusCode = 200;
        result.body = JSON.stringify(update);
      } else {
        result.statusCode = 404;
        result.body = 'Item not found';
      }
    } else if (httpMethod === 'DELETE') {
      const deletedItem = await deleteItem(DB_TABLE_NAME, validQueryStringParams.data);
      if (Object.keys(deletedItem).length > 0) {
        result.statusCode = 200;
        result.body = JSON.stringify(deletedItem);
      } else {
        result.statusCode = 404;
        result.body = 'Item not found';
      }
    } else {
      result.statusCode = 405;
      result.body = 'Method Not Allowed';
    }
  } catch (e) {
    console.error(e);
  }

  return result;
};
