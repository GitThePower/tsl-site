import { DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand, ReturnValue, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodEffects, ZodTypeAny } from 'zod';
import { ResourceLambdaEnvSchema } from '../../src/types';
import config from '../../lib/config';

let _dynamoDbClient: DynamoDBClient | null;
const getDdbClient = (): DynamoDBClient => {
  if (!_dynamoDbClient) {
    _dynamoDbClient = new DynamoDBClient();
  }
  return _dynamoDbClient;
};

const getResponse = (statusCode: number, body: string): APIGatewayProxyResult => {
  return {
    body,
    headers: {
      'Access-Control-Allow-Origin': `https://${config.domainName}`,
    },
    statusCode,
  };
};

// **Create (Put)**
export const createItem = async (tableName: string, data: any): Promise<void> => {
  const params = {
    TableName: tableName,
    Item: marshall(data),
  };
  const client = getDdbClient();
  await client.send(new PutItemCommand(params));
};

// **Read (Get)**
export const getItem = async (tableName: string, query: any): Promise<{ Item: Record<string, any> | null }> => {
  const params = {
    TableName: tableName,
    Key: marshall(query),
  };
  const client = getDdbClient();
  const { Item } = await client.send(new GetItemCommand(params));
  return {
    Item: (Item) ? unmarshall(Item) : null,
  }
};

// **Update**
export const updateItem = async (tableName: string, query: any, data: any): Promise<{ Item: Record<string, any> | null }> => {
  const update = data;
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
    Key: marshall(query),
    UpdateExpression,
    ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW' as ReturnValue,
  };
  const client = getDdbClient();
  const { Attributes } = await client.send(new UpdateItemCommand(params));
  return {
    Item: (Attributes) ? unmarshall(Attributes) : null,
  }
};

// **Delete**
export const deleteItem = async (tableName: string, query: any): Promise<{ Item: Record<string, any> | null }> => {
  const params = {
    TableName: tableName,
    Key: marshall(query),
    ReturnValues: 'ALL_OLD' as ReturnValue,
  };
  const client = getDdbClient();
  const { Attributes } = await client.send(new DeleteItemCommand(params));
  return {
    Item: (Attributes) ? unmarshall(Attributes) : null,
  }
};

// **Scan (List)**
export const listItems = async (tableName: string): Promise<{ Items: Record<string, any>[] | null }> => {
  const params = {
    TableName: tableName,
  };
  const client = getDdbClient();
  const { Items } = await client.send(new ScanCommand(params));
  return {
    Items: (Items) ? Items.map((item) => unmarshall(item)) : null,
  }
};

export const ddbCrudHandler = async (event: APIGatewayProxyEvent, itemSchema: ZodEffects<ZodTypeAny>): Promise<APIGatewayProxyResult> => {
  try {
    const { DB_TABLE_NAME } = ResourceLambdaEnvSchema.parse(process.env);
    const { body, httpMethod, queryStringParameters } = event;
    const parsedQueryStringParams = (queryStringParameters) ? itemSchema.safeParse(queryStringParameters) : null;
    const parsedBody = (body) ? itemSchema.safeParse(JSON.parse(body)) : null;

    if (httpMethod === 'GET') {
      if (parsedQueryStringParams) {
        if (!parsedQueryStringParams.success) {
          return getResponse(400, `QueryStringParametersErr: ${(parsedQueryStringParams) ? parsedQueryStringParams.error : 'queryStringParameters is not defined'}`);
        }
        const { Item } = await getItem(DB_TABLE_NAME, parsedQueryStringParams.data);
        if (Item) {
          return getResponse(200, JSON.stringify(Item));
        }
        return getResponse(404, 'Not found');
      }
      const { Items } = await listItems(DB_TABLE_NAME);
      if (Items) {
        return getResponse(200, JSON.stringify(Items));
      }
      return getResponse(404, 'Not found');
    } else if (httpMethod === 'POST') {
      if (!parsedBody || !parsedBody.success) {
        return getResponse(400, `BodyErr: ${(parsedBody) ? parsedBody.error : 'body is not defined'}`);
      }
      await createItem(DB_TABLE_NAME, parsedBody.data);
      return getResponse(200, 'Successful Create!');
    } else if (httpMethod === 'PUT') {
      if (!parsedBody || !parsedBody.success || !parsedQueryStringParams || !parsedQueryStringParams.success) {
        const bodyErr = (!parsedBody) ? 'body is not defined' : (!parsedBody.success) ? parsedBody.error : '';
        const queryStringParametersErr = (!parsedQueryStringParams) ? 'queryStringParameters is not defined' : (!parsedQueryStringParams.success) ? parsedQueryStringParams.error : '';
        return getResponse(400, `BodyErr: ${bodyErr}\nQueryStringParametersErr: ${queryStringParametersErr}`);
      }
      const { Item } = await updateItem(DB_TABLE_NAME, parsedQueryStringParams.data, parsedBody.data);
      if (Item) {
        return getResponse(200, JSON.stringify(Item));
      }
      return getResponse(404, 'Not found');
    } else if (httpMethod === 'DELETE') {
      if (!parsedQueryStringParams || !parsedQueryStringParams.success) {
        return getResponse(400, `QueryStringParametersErr: ${(parsedQueryStringParams) ? parsedQueryStringParams.error : 'queryStringParameters is not defined'}`);
      }
      const { Item } = await deleteItem(DB_TABLE_NAME, parsedQueryStringParams.data);
      if (Item) {
        return getResponse(200, JSON.stringify(Item));
      }
      return getResponse(404, 'Not found');
    } else {
      return getResponse(405, 'Method Not Allowed');
    }
  } catch (err) {
    console.error(err);
    return getResponse(500, 'Unexpected Error - check logs');
  }
};
