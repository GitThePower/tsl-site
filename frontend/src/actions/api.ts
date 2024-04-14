import { z } from 'zod';
import config from '../../../backend/lib/config';
import { Session, SessionSchema, User, UserSchema } from '../../../backend/src/types';

const baseUrl = (process.env.NODE_ENV && process.env.NODE_ENV === 'dev') ?
 '/proxy' :
 `https://${config.domainNameApi}`;

const getUser = async (username: string): Promise<User> => {
  let user = {} as User;
  try {
    const res = await fetch(`${baseUrl}/${config.resource_user}?username=${username}`, {
      method: 'GET',
    })
    .then(res => res.json());
    user = UserSchema.parse(res);
  } catch (e) {
    console.error(e);
  }

  return user;
};

const listUsers = async (): Promise<User[]> => {
  let users = [] as User[];
  try {
    const res = await fetch(`${baseUrl}/${config.resource_user}`, {
      method: 'GET'
    })
    .then(res => res.json());
    users = z.array(UserSchema).parse(res);
  } catch (e) {
    console.error(e);
  }

  return users;
};

const updateUser = async (username: string, update: User): Promise<User> => {
  let user = {} as User;
  try {
    const res = await fetch(`${baseUrl}/${config.resource_user}?username=${username}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    })
    .then(res => res.json());
    user = UserSchema.parse(res);
  } catch (e) {
    console.error(e);
  }

  return user;
};

const createSession = async (session: Session): Promise<void> => {
  try {
    await fetch(`${baseUrl}/${config.resource_session}`, {
      method: 'POST',
      body: JSON.stringify(session),
    });
  } catch (e) {
    console.error(e);
  }
};

const getSession = async (sessionid: string): Promise<Session> => {
  let session = {} as Session;
  try {
    const res = await fetch(`${baseUrl}/${config.resource_session}?sessionid=${sessionid}`, {
      method: 'GET',
    })
    .then(res => res.json());
    session = SessionSchema.parse(res);
  } catch (e) {
    console.error(e);
  }

  return session;
};

export default {
  createSession,
  getSession,
  getUser,
  listUsers,
  updateUser,
};
