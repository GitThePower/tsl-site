import { Session, User } from '../../../backend/src/types';

const sessionIsActive = (session: Session): boolean => Boolean(
  session.sessionid &&
  session.expiration &&
  parseInt(session.expiration, 10) > Date.now(),
);

const userIsAdmin = (session: Session, user: User): boolean => Boolean(
  sessionIsActive(session) &&
  user.roles?.includes('admin'),
);

export default {
  sessionIsActive,
  userIsAdmin,
};
