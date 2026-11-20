import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CreateUserSchema,
  ResourceLambdaEnvSchema,
  UpdateUserBodySchema,
  User,
  UserSchema,
} from '../types';
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  updateItem,
} from '../utils/ddb';
import { getAuthorizerContext, getResponse } from '../utils/lambda';
import { hashPassword, verifyPassword } from '../utils/password';

const sanitizeUser = (user: User): User => ({
  ...user,
  password: '[ HIDDEN ]',
  roles: user.roles && user.roles.length > 0 ? user.roles : ['player'],
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { DB_TABLE_NAME } = ResourceLambdaEnvSchema.parse(process.env);
    const { body, httpMethod, queryStringParameters } = event;

    if (httpMethod === 'GET') {
      if (queryStringParameters) {
        const parsedQuery = UserSchema.safeParse(queryStringParameters);
        if (!parsedQuery.success || !parsedQuery.data.username) {
          return getResponse(400, `QueryStringParametersErr: ${parsedQuery.success ? 'username is required' : parsedQuery.error}`);
        }
        const { Item } = await getItem(DB_TABLE_NAME, { username: parsedQuery.data.username });
        if (Item) {
          const user = UserSchema.parse(Item);
          return getResponse(200, JSON.stringify(sanitizeUser(user)));
        }
        return getResponse(404, 'Not found');
      }

      const { Items } = await listItems(DB_TABLE_NAME);
      const users: User[] = (Items ?? []).map((Item) => sanitizeUser(UserSchema.parse(Item)));
      return getResponse(200, JSON.stringify(users));
    }

    if (httpMethod === 'POST') {
      const { isAdmin } = getAuthorizerContext(event);
      if (!isAdmin) {
        return getResponse(403, 'Forbidden');
      }

      if (!body) {
        return getResponse(400, 'BodyErr: body is not defined');
      }

      let rawBody: unknown;
      try {
        rawBody = JSON.parse(body);
      } catch {
        return getResponse(400, 'BodyErr: Invalid JSON body');
      }

      const parsedBody = CreateUserSchema.safeParse(rawBody);
      if (!parsedBody.success) {
        return getResponse(400, `BodyErr: ${parsedBody.error}`);
      }

      const username = parsedBody.data.username.trim();
      if (!username) {
        return getResponse(400, 'BodyErr: username cannot be blank');
      }

      const { Item: existing } = await getItem(DB_TABLE_NAME, { username });
      if (existing) {
        return getResponse(409, 'User already exists');
      }

      const dedupedRoles = parsedBody.data.roles
        ? Array.from(new Set(parsedBody.data.roles))
        : [];
      const newUser: User = {
        leagues: parsedBody.data.leagues ?? [],
        password: hashPassword(parsedBody.data.password),
        roles: dedupedRoles.length > 0 ? dedupedRoles : ['player'],
        username,
      };
      await createItem(DB_TABLE_NAME, newUser);
      return getResponse(200, JSON.stringify(sanitizeUser(newUser)));
    }

    if (httpMethod === 'PUT') {
      const parsedQuery = queryStringParameters ? UserSchema.safeParse(queryStringParameters) : null;
      if (!parsedQuery || !parsedQuery.success || !parsedQuery.data.username) {
        return getResponse(400, `QueryStringParametersErr: ${!parsedQuery ? 'queryStringParameters is not defined' : !parsedQuery.success ? parsedQuery.error : 'username is required'}`);
      }

      if (!body) {
        return getResponse(400, 'BodyErr: body is not defined');
      }

      let rawBody: unknown;
      try {
        rawBody = JSON.parse(body);
      } catch {
        return getResponse(400, 'BodyErr: Invalid JSON body');
      }

      const parsedBody = UpdateUserBodySchema.safeParse(rawBody);
      if (!parsedBody.success) {
        return getResponse(400, `BodyErr: ${parsedBody.error}`);
      }

      const targetUsername = parsedQuery.data.username;
      const { isAdmin, username: callerUsername } = getAuthorizerContext(event);

      const { Item: existingItem } = await getItem(DB_TABLE_NAME, { username: targetUsername });
      if (!existingItem) {
        return getResponse(404, 'Not found');
      }
      const existingUser = UserSchema.parse(existingItem);

      if (!isAdmin) {
        if (callerUsername !== targetUsername) {
          return getResponse(403, 'Forbidden');
        }
        if (parsedBody.data.roles !== undefined) {
          return getResponse(403, 'Only admins can update roles');
        }
        if (parsedBody.data.password !== undefined) {
          if (
            !parsedBody.data.currentPassword ||
            !verifyPassword(parsedBody.data.currentPassword, existingUser.password)
          ) {
            return getResponse(403, 'Current password is incorrect');
          }
        }
      } else if (
        callerUsername &&
        callerUsername === targetUsername &&
        parsedBody.data.roles !== undefined &&
        !parsedBody.data.roles.includes('admin')
      ) {
        return getResponse(400, 'Cannot remove your own admin role');
      }

      const updatePayload: Partial<User> = {};
      if (parsedBody.data.leagues !== undefined) {
        updatePayload.leagues = parsedBody.data.leagues;
      }
      if (parsedBody.data.password !== undefined) {
        updatePayload.password = hashPassword(parsedBody.data.password);
      }
      if (parsedBody.data.roles !== undefined) {
        const dedupedRoles = Array.from(new Set(parsedBody.data.roles));
        updatePayload.roles = dedupedRoles.length > 0 ? dedupedRoles : ['player'];
      }

      if (Object.keys(updatePayload).length === 0) {
        return getResponse(400, 'BodyErr: No updatable fields provided');
      }

      const { Item: updatedItem } = await updateItem(DB_TABLE_NAME, { username: targetUsername }, updatePayload);
      if (updatedItem) {
        const updatedUser = UserSchema.parse(updatedItem);
        return getResponse(200, JSON.stringify(sanitizeUser(updatedUser)));
      }
      return getResponse(404, 'Not found');
    }

    if (httpMethod === 'DELETE') {
      const { isAdmin, username: callerUsername } = getAuthorizerContext(event);
      if (!isAdmin) {
        return getResponse(403, 'Forbidden');
      }

      const parsedQuery = queryStringParameters ? UserSchema.safeParse(queryStringParameters) : null;
      if (!parsedQuery || !parsedQuery.success || !parsedQuery.data.username) {
        return getResponse(400, `QueryStringParametersErr: ${!parsedQuery ? 'queryStringParameters is not defined' : !parsedQuery.success ? parsedQuery.error : 'username is required'}`);
      }

      const targetUsername = parsedQuery.data.username;
      if (callerUsername && callerUsername === targetUsername) {
        return getResponse(400, 'Cannot delete your own account');
      }

      const { Item } = await deleteItem(DB_TABLE_NAME, { username: targetUsername });
      if (Item) {
        const deletedUser = UserSchema.parse(Item);
        return getResponse(200, JSON.stringify(sanitizeUser(deletedUser)));
      }
      return getResponse(404, 'Not found');
    }

    return getResponse(405, 'Method Not Allowed');
  } catch (err) {
    console.error(err);
    return getResponse(500, 'Unexpected Error - check logs');
  }
};
