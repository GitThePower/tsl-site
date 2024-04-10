import config from '../../../backend/lib/config';
import { Session, SessionSchema, User, UserSchema } from '../../../backend/src/types';

const baseUrl = `https://${config.domainNameApi}`;

const getUser = async (username: string): Promise<User> => {
  let user = {} as User;
  try {
    const res = await fetch(`${baseUrl}/${config.resource_user}?username=${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'x-www-form-urlencoded',
      }
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
      headers: {
        'Content-Type': 'application/json',
      },
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
      headers: {
        'Content-Type': 'x-www-form-urlencoded',
      }
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
};
