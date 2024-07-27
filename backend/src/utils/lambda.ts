import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodEffects, ZodTypeAny } from 'zod';
import config from '../../lib/config';

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
  DeleteHandler?: (queryStringParameters: any) => Promise<APIGatewayProxyResult>;
  GetHandler?: (queryStringParameters: any) => Promise<APIGatewayProxyResult>;
  ListHandler?: () => Promise<APIGatewayProxyResult>;
  PostHandler?: (body: any) => Promise<APIGatewayProxyResult>;
  PutHandler?: (body: any, queryStringParameters: any) => Promise<APIGatewayProxyResult>;
}

export const crudHandler = async (event: APIGatewayProxyEvent, itemSchema: ZodEffects<ZodTypeAny>, methodHandlers: MethodHandlers): Promise<APIGatewayProxyResult> => {
  try {
    const { body, httpMethod, queryStringParameters } = event;
    const parsedQueryStringParams = (queryStringParameters) ? itemSchema.safeParse(queryStringParameters) : null;
    const parsedBody = (body) ? itemSchema.safeParse(JSON.parse(body)) : null;
    const { DeleteHandler, GetHandler, ListHandler, PostHandler, PutHandler } = methodHandlers;

    if (httpMethod === 'GET' && GetHandler && ListHandler) {
      if (parsedQueryStringParams) {
        if (!parsedQueryStringParams.success) {
          return getResponse(400, `QueryStringParametersErr: ${(parsedQueryStringParams) ? parsedQueryStringParams.error : 'queryStringParameters is not defined'}`);
        }
        return GetHandler(parsedQueryStringParams.data);
      }
      return ListHandler();
    } else if (httpMethod === 'POST' && PostHandler) {
      if (!parsedBody || !parsedBody.success) {
        return getResponse(400, `BodyErr: ${(parsedBody) ? parsedBody.error : 'body is not defined'}`);
      }
      return PostHandler(parsedBody.data);
    } else if (httpMethod === 'PUT' && PutHandler) {
      if (!parsedBody || !parsedBody.success || !parsedQueryStringParams || !parsedQueryStringParams.success) {
        const bodyErr = (!parsedBody) ? 'body is not defined' : (!parsedBody.success) ? parsedBody.error : '';
        const queryStringParametersErr = (!parsedQueryStringParams) ? 'queryStringParameters is not defined' : (!parsedQueryStringParams.success) ? parsedQueryStringParams.error : '';
        return getResponse(400, `BodyErr: ${bodyErr}\nQueryStringParametersErr: ${queryStringParametersErr}`);
      }
      return PutHandler(parsedBody.data, parsedQueryStringParams.data);
    } else if (httpMethod === 'DELETE' && DeleteHandler) {
      if (!parsedQueryStringParams || !parsedQueryStringParams.success) {
        return getResponse(400, `QueryStringParametersErr: ${(parsedQueryStringParams) ? parsedQueryStringParams.error : 'queryStringParameters is not defined'}`);
      }
      return DeleteHandler(parsedQueryStringParams.data);
    } else {
      return getResponse(405, 'Method Not Allowed');
    }
  } catch (err) {
    console.error(err);
    return getResponse(500, 'Unexpected Error - check logs');
  }
};