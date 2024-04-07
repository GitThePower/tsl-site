import { DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand, ReturnValue, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SafeParseReturnType, ZodEffects, ZodTypeAny } from 'zod';
import { ResourceLambdaEnvSchema } from '../../src/types';
import config from '../../lib/config';

let _dynamoDbClient: DynamoDBClient | null;
const getDdbClient = (): DynamoDBClient => {
  if (!_dynamoDbClient) {
    _dynamoDbClient = new DynamoDBClient();
  }
  return _dynamoDbClient;
};

// **Create (Put)**
export const createItem = async (tableName: string, parsedBody: SafeParseReturnType<any, any> | null): Promise<APIGatewayProxyResult> => {
  if (!parsedBody || !parsedBody.success) {
    return {
      statusCode: 400,
      body: `BodyErr: ${(parsedBody) ? parsedBody.error : 'body is not defined'}`,
    };
  }
  const params = {
    TableName: tableName,
    Item: marshall(parsedBody.data),
  };
  try {
    const client = getDdbClient();
    await client.send(new PutItemCommand(params));
    return {
      statusCode: 200,
      body: 'Successfully created item!',
    };
  } catch (err) {
    console.error(`Error adding item: ${err}`);
    return {
      statusCode: 500,
      body: 'Error adding item - check logs',
    };
  }
};

// **Read (Get)**
export const getItem = async (tableName: string, parsedQueryStringParams: SafeParseReturnType<any, any> | null): Promise<APIGatewayProxyResult> => {
  if (!parsedQueryStringParams || !parsedQueryStringParams.success) {
    return {
      statusCode: 400,
      body: `QueryStringParametersErr: ${(parsedQueryStringParams) ? parsedQueryStringParams.error : 'queryStringParameters is not defined'}`,
      headers: {
        'Access-Control-Allow-Origin': `https://${config.domainName}`,
      },
    };
  }
  const params = {
    TableName: tableName,
    Key: marshall(parsedQueryStringParams.data),
  };
  try {
    const client = getDdbClient();
    const { Item } = await client.send(new GetItemCommand(params));
    if (Item) {
      return {
        statusCode: 200,
        body: JSON.stringify(unmarshall(Item)),
        headers: {
          'Access-Control-Allow-Origin': `https://${config.domainName}`,
        },
      };
    }
    return {
      statusCode: 404,
      body: 'Item not found',
      headers: {
        'Access-Control-Allow-Origin': `https://${config.domainName}`,
      },
    };
  } catch (err) {
    console.error(`Error retrieving item: ${err}`);
    return {
      statusCode: 500,
      body: 'Error retrieving item - check logs',
      headers: {
        'Access-Control-Allow-Origin': `https://${config.domainName}`,
      },
    };
  }
};

// **Update**
export const updateItem = async (tableName: string, parsedQueryStringParams: SafeParseReturnType<any, any> | null, parsedBody: SafeParseReturnType<any, any> | null): Promise<APIGatewayProxyResult> => {
  if (!parsedBody || !parsedBody.success || !parsedQueryStringParams || !parsedQueryStringParams.success) {
    const bodyErr = (!parsedBody) ? 'body is not defined' : (!parsedBody.success) ? parsedBody.error : '';
    const queryStringParametersErr = (!parsedQueryStringParams) ? 'queryStringParameters is not defined' : (!parsedQueryStringParams.success) ? parsedQueryStringParams.error : '';
    return {
      statusCode: 400,
      body: `BodyErr: ${bodyErr}\nQueryStringParametersErr: ${queryStringParametersErr}`,
    };
  }

  const update = parsedBody.data;
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
    Key: marshall(parsedQueryStringParams.data),
    UpdateExpression,
    ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW' as ReturnValue,
  };
  try {
    const client = getDdbClient();
    const { Attributes } = await client.send(new UpdateItemCommand(params));
    if (Attributes) {
      return {
        statusCode: 200,
        body: JSON.stringify(unmarshall(Attributes)),
      };
    } else {
      return {
        statusCode: 404,
        body: 'Item not found',
      };
    }
  } catch (err) {
    console.error(`Error updating item: ${err}`);
    return {
      statusCode: 500,
      body: 'Error updating item - check logs',
    };
  }
};

// **Delete**
export const deleteItem = async (tableName: string, parsedQueryStringParams: SafeParseReturnType<any, any> | null): Promise<APIGatewayProxyResult> => {
  if (!parsedQueryStringParams || !parsedQueryStringParams.success) {
    return {
      statusCode: 400,
      body: `QueryStringParametersErr: ${(parsedQueryStringParams) ? parsedQueryStringParams.error : 'queryStringParameters is not defined'}`,
    };
  }
  const params = {
    TableName: tableName,
    Key: marshall(parsedQueryStringParams.data),
    ReturnValues: 'ALL_OLD' as ReturnValue,
  };
  try {
    const client = getDdbClient();
    const { Attributes } = await client.send(new DeleteItemCommand(params));
    if (Attributes) {
      return {
        statusCode: 200,
        body: JSON.stringify(unmarshall(Attributes)),
      };
    }
    return {
      statusCode: 404,
      body: 'Item not found',
    };
  } catch (err) {
    console.error(`Error deleting item: ${err}`);
    return {
      statusCode: 500,
      body: 'Error deleting item - check logs',
    };
  }
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
    console.error('Error listing items:', err);
  }
  return results;
};

export const ddbCrudHandler = async (event: APIGatewayProxyEvent, itemSchema: ZodEffects<ZodTypeAny>): Promise<APIGatewayProxyResult> => {
  try {
    const { DB_TABLE_NAME } = ResourceLambdaEnvSchema.parse(process.env);
    const { body, httpMethod, queryStringParameters } = event;

    if (httpMethod === 'GET') {
      const parsedQueryStringParams = (queryStringParameters) ? itemSchema.safeParse(queryStringParameters) : null;
      return await getItem(DB_TABLE_NAME, parsedQueryStringParams);
    } else if (httpMethod === 'POST') {
      const parsedBody = (body) ? itemSchema.safeParse(JSON.parse(body)) : null;
      return await createItem(DB_TABLE_NAME, parsedBody);
    } else if (httpMethod === 'PUT') {
      const parsedQueryStringParams = (queryStringParameters) ? itemSchema.safeParse(queryStringParameters) : null;
      const parsedBody = (body) ? itemSchema.safeParse(JSON.parse(body)) : null;
      return await updateItem(DB_TABLE_NAME, parsedQueryStringParams, parsedBody);
    } else if (httpMethod === 'DELETE') {
      const parsedQueryStringParams = (queryStringParameters) ? itemSchema.safeParse(queryStringParameters) : null;
      return await deleteItem(DB_TABLE_NAME, parsedQueryStringParams);
    } else {
      return {
        statusCode: 405,
        body: 'Method Not Allowed',
      };
    }
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: 'Internal Error - check logs',
    };
  }
};
