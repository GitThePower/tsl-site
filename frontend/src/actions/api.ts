import config from '../../../backend/lib/config';
import { User, UserSchema } from '../../../backend/src/user';

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
    console.log(res);
    user = UserSchema.parse(res);
  } catch (e) {
    console.error(e);
  }

  return user;
};

export default {
  getUser,
};
