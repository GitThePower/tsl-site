import {
  APIGatewayEventDefaultAuthorizerContext,
  APIGatewayEventRequestContextWithAuthorizer,
  APIGatewayProxyEvent,
} from 'aws-lambda';
import { handler } from '../../lib/lambdas/pools';
import { MagicCardSchema } from '../../types';

describe('Pools Lambda', () => {
  let event: APIGatewayProxyEvent;
  beforeEach(() => {
    event = {
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: true,
      path: '',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as unknown as APIGatewayEventRequestContextWithAuthorizer<APIGatewayEventDefaultAuthorizerContext>,
      resource: '',
    };
  });

  describe('/GET', () => {
    beforeEach(() => {
      event.httpMethod = 'GET';
    });
  
    it('should return a body that parses to a list', async () => {
      event.pathParameters = {
        id: 'QUoKeyN9CUiANOv24t2WtQ',
      };
      const result = await handler(event);
      expect(Array.isArray(JSON.parse(result.body))).toEqual(true);
    });
  
    it('should return a body that parses to a list of MagicCards', async () => {
      event.pathParameters = {
        id: 'QUoKeyN9CUiANOv24t2WtQ',
      };
      const result = await handler(event);
      expect(JSON.parse(result.body).length).toBeGreaterThan(0);
      expect(
        MagicCardSchema.safeParse(JSON.parse(result.body)[0]).success
      ).toEqual(true);
    });
  });
});
