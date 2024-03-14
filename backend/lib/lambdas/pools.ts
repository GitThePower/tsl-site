import { APIGatewayProxyEvent, APIGatewayProxyEventPathParameters, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';
import { z } from 'zod';
import { MoxfieldContentSchema } from '../../types';

const handleGet = async (pathParameters: APIGatewayProxyEventPathParameters | null): Promise<APIGatewayProxyResult> => {
  if (pathParameters) {
    const id = pathParameters?.id;
    const request = await axios.get(`https://api2.moxfield.com/v3/decks/all/${id}`);
    if (request.data) {
      const content = MoxfieldContentSchema.parse(request.data);
      console.log(content);
    }
  }
  return {
    statusCode: 200,
    body: '[ { "name": "Inside Source", "count": 5 } ]',
  };
};

const handlePost = async (body: string | null): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 204,
    body: 'No Content',
  };
};

const handlePut = async (body: string | null): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 204,
    body: 'No Content',
  };
};

const handleDelete = async (body: string | null): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 204,
    body: 'No Content',
  };
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { body, httpMethod, pathParameters } = event;

  if (httpMethod === 'GET') {
    return await handleGet(pathParameters);
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
