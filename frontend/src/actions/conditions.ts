import { Session } from '../../../backend/src/types';

const sessionIsActive = (session: Session) => {
  return session.sessionid && session.expiration &&
    parseInt(session.expiration, 10) > Date.now();
};

export default {
  sessionIsActive,
};
