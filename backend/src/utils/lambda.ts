import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodType } from 'zod';
import config from '../../lib/config';
import { AuthorizerContextSchema } from '../types';

export interface ParsedAuthorizerContext {
  isAdmin: boolean;
  username: string;
}

export const getAuthorizerContext = (event: APIGatewayProxyEvent): ParsedAuthorizerContext => {
  const parsed = AuthorizerContextSchema.safeParse(event.requestContext?.authorizer);
  if (!parsed.success) {
    return {
      isAdmin: false,
      username: '',
    };
  }
  return {
    isAdmin: parsed.data.isAdmin === 'true',
    username: parsed.data.username,
  };
};

export const getResponse = (statusCode: number, body: string): APIGatewayProxyResult => {
  return {
    body,
    headers: {
      'Access-Control-Allow-Origin': `https://${config.domainName}`,
    },
    statusCode,
  };
};

export interface MethodHandlers {
  DeleteHandler?: (queryStringParameters: any, event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
  GetHandler?: (queryStringParameters: any, event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
  ListHandler?: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
  PostHandler?: (body: any, event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
  PutHandler?: (body: any, queryStringParameters: any, event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
}

export const crudHandler = async (event: APIGatewayProxyEvent, itemSchema: ZodType, methodHandlers: MethodHandlers): Promise<APIGatewayProxyResult> => {
  try {
    const { body, httpMethod, queryStringParameters } = event;
    const parsedQueryStringParams = (queryStringParameters) ? itemSchema.safeParse(queryStringParameters) : null;
    let parsedJsonBody: unknown = null;
    if (body) {
      try {
        parsedJsonBody = JSON.parse(body);
      } catch {
        return getResponse(400, 'BodyErr: Invalid JSON body');
      }
    }
    const parsedBody = (body) ? itemSchema.safeParse(parsedJsonBody) : null;
    const { DeleteHandler, GetHandler, ListHandler, PostHandler, PutHandler } = methodHandlers;

    if (httpMethod === 'GET' && GetHandler && ListHandler) {
      if (parsedQueryStringParams) {
        if (!parsedQueryStringParams.success) {
          return getResponse(400, `QueryStringParametersErr: ${(parsedQueryStringParams) ? parsedQueryStringParams.error : 'queryStringParameters is not defined'}`);
        }
        return GetHandler(parsedQueryStringParams.data, event);
      }
      return ListHandler(event);
    } else if (httpMethod === 'POST' && PostHandler) {
      if (!parsedBody || !parsedBody.success) {
        return getResponse(400, `BodyErr: ${(parsedBody) ? parsedBody.error : 'body is not defined'}`);
      }
      return PostHandler(parsedBody.data, event);
    } else if (httpMethod === 'PUT' && PutHandler) {
      if (!parsedBody || !parsedBody.success || !parsedQueryStringParams || !parsedQueryStringParams.success) {
        const bodyErr = (!parsedBody) ? 'body is not defined' : (!parsedBody.success) ? parsedBody.error : '';
        const queryStringParametersErr = (!parsedQueryStringParams) ? 'queryStringParameters is not defined' : (!parsedQueryStringParams.success) ? parsedQueryStringParams.error : '';
        return getResponse(400, `BodyErr: ${bodyErr}\nQueryStringParametersErr: ${queryStringParametersErr}`);
      }
      return PutHandler(parsedBody.data, parsedQueryStringParams.data, event);
    } else if (httpMethod === 'DELETE' && DeleteHandler) {
      if (!parsedQueryStringParams || !parsedQueryStringParams.success) {
        return getResponse(400, `QueryStringParametersErr: ${(parsedQueryStringParams) ? parsedQueryStringParams.error : 'queryStringParameters is not defined'}`);
      }
      return DeleteHandler(parsedQueryStringParams.data, event);
    } else {
      return getResponse(405, 'Method Not Allowed');
    }
  } catch (err) {
    console.error(err);
    return getResponse(500, 'Unexpected Error - check logs');
  }
};