import backendConfig from '../../../backend/lib/config';
import { League, Session, SessionSchema, User } from '../../../backend/src/types';
import { config } from '../../../local-config';

const baseUrl = (process.env.NODE_ENV && process.env.NODE_ENV === 'dev') ?
  '/proxy' :
  `https://${backendConfig.domainNameApi}`;

const sharedHeaders = {
  'X-Api-Key': config.apiKeyValue,
};

const getUser = async (username: string): Promise<User> => {
  let user = {} as User;
  try {
    const res = await fetch(`${baseUrl}/${backendConfig.resource_user}?username=${username}`, {
      method: 'GET',
      headers: sharedHeaders,
    })
      .then(res => res.json());
    user = res;
  } catch (e) {
    console.error(e);
  }

  return user;
};

const listUsers = async (): Promise<User[]> => {
  let users = [] as User[];
  try {
    const res = await fetch(`${baseUrl}/${backendConfig.resource_user}`, {
      method: 'GET',
      headers: sharedHeaders,
    })
      .then(res => res.json());
    users = res;
  } catch (e) {
    console.error(e);
  }

  return users;
};

const updateUser = async (username: string, update: User): Promise<User> => {
  let user = {} as User;
  try {
    const res = await fetch(`${baseUrl}/${backendConfig.resource_user}?username=${username}`, {
      method: 'PUT',
      body: JSON.stringify(update),
      headers: sharedHeaders,
    })
      .then(res => res.json());
    user = res;
  } catch (e) {
    console.error(e);
  }

  return user;
};

const createSession = async (session: Session): Promise<void> => {
  try {
    await fetch(`${baseUrl}/${backendConfig.resource_session}`, {
      method: 'POST',
      body: JSON.stringify(session),
      headers: sharedHeaders,
    });
  } catch (e) {
    console.error(e);
  }
};

const getSession = async (sessionid: string): Promise<Session> => {
  let session = {} as Session;
  try {
    const res = await fetch(`${baseUrl}/${backendConfig.resource_session}?sessionid=${sessionid}`, {
      method: 'GET',
      headers: sharedHeaders,
    })
      .then(res => res.json());
    session = SessionSchema.parse(res);
  } catch (e) {
    console.error(e);
  }

  return session;
};



const listLeagues = async (): Promise<League[]> => {
  let leagues = [] as League[];
  try {
    const res = await fetch(`${baseUrl}/${backendConfig.resource_league}`, {
      method: 'GET',
      headers: sharedHeaders,
    })
      .then(res => res.json());
    leagues = res;
  } catch (e) {
    console.error(e);
  }

  return leagues;
};

export default {
  createSession,
  getSession,
  getUser,
  listLeagues,
  listUsers,
  updateUser,
};
