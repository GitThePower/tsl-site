import {
  APIGatewayEventDefaultAuthorizerContext,
  APIGatewayEventRequestContextWithAuthorizer,
  APIGatewayProxyEvent,
} from 'aws-lambda';
import { handler } from '../../lib/lambdas/pools';
import { MagicCardPoolSchema } from '../../types';

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
  
    it('should return a body that parses to a MagicCardPool', async () => {
      event.pathParameters = {
        id: 'QUoKeyN9CUiANOv24t2WtQ',
      };
      const result = await handler(event);
      expect(
        MagicCardPoolSchema.safeParse(JSON.parse(result.body)).success
      ).toEqual(true);
    });
  });
});
