import backendConfig from '../../../backend/lib/config';
import {
  CreateUserInput,
  League,
  Session,
  SessionSchema,
  UpdateUserInput,
  User,
} from '../../../backend/src/types';
import { config } from '../../../local-config';

const baseUrl = (process.env.NODE_ENV && process.env.NODE_ENV === 'dev') ?
  '/proxy' :
  `https://${backendConfig.domainNameApi}`;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Key': config.apiKeyValues[1] || config.apiKeyValues[0],
  };
  const sessionId = localStorage.getItem(config.sessionIdLocalStorageKey);
  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }
  return headers;
};

const requestJson = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(res.status, text || `Request failed with status ${res.status}`);
  }

  return (text ? JSON.parse(text) : undefined) as T;
};

const createLeague = async (league: { isActive?: boolean; leaguename: string }): Promise<League> =>
  requestJson<League>(`/${backendConfig.resource_league}`, {
    body: JSON.stringify(league),
    method: 'POST',
  });

const createUser = async (user: CreateUserInput): Promise<User> =>
  requestJson<User>(`/${backendConfig.resource_user}`, {
    body: JSON.stringify(user),
    method: 'POST',
  });

const deleteLeague = async (leaguename: string): Promise<League> =>
  requestJson<League>(`/${backendConfig.resource_league}?leaguename=${encodeURIComponent(leaguename)}`, {
    method: 'DELETE',
  });

const deleteSession = async (sessionid: string): Promise<void> => {
  await requestJson<Session>(`/${backendConfig.resource_session}?sessionid=${encodeURIComponent(sessionid)}`, {
    method: 'DELETE',
  });
};

const deleteUser = async (username: string): Promise<User> =>
  requestJson<User>(`/${backendConfig.resource_user}?username=${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });

const getSession = async (sessionid: string): Promise<Session> => {
  const res = await requestJson<unknown>(`/${backendConfig.resource_session}?sessionid=${encodeURIComponent(sessionid)}`, {
    method: 'GET',
  });
  return SessionSchema.parse(res);
};

const getUser = async (username: string): Promise<User> =>
  requestJson<User>(`/${backendConfig.resource_user}?username=${encodeURIComponent(username)}`, {
    method: 'GET',
  });

const listLeagues = async (): Promise<League[]> =>
  requestJson<League[]>(`/${backendConfig.resource_league}`, {
    method: 'GET',
  });

const listUsers = async (): Promise<User[]> =>
  requestJson<User[]>(`/${backendConfig.resource_user}`, {
    method: 'GET',
  });

const login = async (username: string, password: string): Promise<Session> => {
  const res = await requestJson<unknown>(`/${backendConfig.resource_session}`, {
    body: JSON.stringify({ password, username }),
    method: 'POST',
  });
  return SessionSchema.parse(res);
};

const updateLeague = async (leaguename: string, update: Partial<League>): Promise<League> =>
  requestJson<League>(`/${backendConfig.resource_league}?leaguename=${encodeURIComponent(leaguename)}`, {
    body: JSON.stringify(update),
    method: 'PUT',
  });

const updateUser = async (username: string, update: UpdateUserInput): Promise<User> =>
  requestJson<User>(`/${backendConfig.resource_user}?username=${encodeURIComponent(username)}`, {
    body: JSON.stringify(update),
    method: 'PUT',
  });

export default {
  createLeague,
  createUser,
  deleteLeague,
  deleteSession,
  deleteUser,
  getSession,
  getUser,
  listLeagues,
  listUsers,
  login,
  updateLeague,
  updateUser,
};
