import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';


const handleGet = async (body: string | null): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    body: '[]',
  };
};

const handlePost = async (body: string | null): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    body: '',
  };
};

const handlePut = async (body: string | null): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    body: '',
  };
};

const handleDelete = async (body: string | null): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    body: '',
  };
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const { body, httpMethod } = event;
  
    if (httpMethod === 'GET') {
      return await handleGet(body);
    } else if (httpMethod === 'POST') {
      return await handlePost(body);
    } else if (httpMethod === 'PUT') {
      return await handlePut(body);
    } else if (httpMethod === 'DELETE') {
      return await handleDelete(body);
    } else {
      return {
        statusCode: 405,
        body: 'Method Not Allowed',
      };
    }
  };
