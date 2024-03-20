import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios, { AxiosResponse } from 'axios';
import { z } from 'zod';
import { MoxfieldContentSchema, MagicCardPool } from '../../types';

const GetRequestSchema = z.object({
  id: z.string(),
});
type GetRequest = z.infer<typeof GetRequestSchema>;
const handleGet = async (request: GetRequest): Promise<APIGatewayProxyResult> => {
  const pool: MagicCardPool = {};
  const { id } = request;
  
  let result: AxiosResponse<any, any>;
  try {
    result = await axios.get(`https://api2.moxfield.com/v3/decks/all/${id}`);
    if (result.status !== 200) {
      return {
        statusCode: result.status,
        body: 'Request to Get decklist from Moxfield failed',
      };
    }
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify(e),
    };
  }
  
  const content = MoxfieldContentSchema.parse(result.data);
  const { boards: { mainboard, sideboard, maybeboard } } = content;
  const promises = [mainboard, sideboard, maybeboard].map(async (board) => {
    const p = Object.keys(board.cards).map((key) => {
      const cardName = board.cards[key].card.name;
      const quantity = board.cards[key].quantity;
      if (pool.hasOwnProperty(cardName)) pool[cardName] = pool[cardName] + quantity;
      else pool[cardName] = quantity;
    });
    await Promise.all(p);
  });
  await Promise.all(promises);

  return {
    statusCode: 200,
    body: JSON.stringify(pool),
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
    const getRequest = GetRequestSchema.parse(pathParameters);
    return await handleGet(getRequest);
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
