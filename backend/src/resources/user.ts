import { APIGatewayProxyEvent } from 'aws-lambda';
import {
  User,
  UserSchema,
  ResourceLambdaEnvSchema,
} from '../types';
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  updateItem,
} from '../utils/ddb';
import { MethodHandlers, crudHandler, getResponse } from '../utils/lambda';

export const handler = async (event: APIGatewayProxyEvent) => {
  const { DB_TABLE_NAME } = ResourceLambdaEnvSchema.parse(process.env);
  const methodHandlers: MethodHandlers = {
    DeleteHandler: async (queryStringParameter: any) => {
      const { Item } = await deleteItem(DB_TABLE_NAME, queryStringParameter.data);
      if (Item) {
        const user = UserSchema.parse(Item);
        return getResponse(200, JSON.stringify(user));
      }
      return getResponse(404, 'Not found');
    },
    GetHandler: async (queryStringParameters: any) => {
      const { Item } = await getItem(DB_TABLE_NAME, queryStringParameters);
      if (Item) {
        const user = UserSchema.parse(Item);
        return getResponse(200, JSON.stringify(user));
      }
      return getResponse(404, 'Not found');
    },
    ListHandler: async () => {
      const { Items } = await listItems(DB_TABLE_NAME);
      if (Items) {
        const userPromises = Items.map(async (Item) => {
          const user = UserSchema.parse(Item);
          return { ...user, password: '[ HIDDEN ]' };
        });
        const users: User[] = await Promise.all(userPromises);
        return getResponse(200, JSON.stringify(users));
      }
      return getResponse(404, 'Not found');
    },
    PostHandler: async (body: any) => {
      const user = UserSchema.parse(body);
      await createItem(DB_TABLE_NAME, user);
      return getResponse(200, 'Successful Create!');
    },
    PutHandler: async (body: any, queryStringParameters: any) => {
      const userQuery = UserSchema.parse(queryStringParameters);
      const userUpdate = UserSchema.parse(body);
      const { Item } = await updateItem(DB_TABLE_NAME, userQuery, userUpdate);
      if (Item) {
        const user = UserSchema.parse(Item);
        return getResponse(200, JSON.stringify(user));
      }
      return getResponse(404, 'Not found');
    },
  }
  return crudHandler(event, UserSchema, methodHandlers);
};
