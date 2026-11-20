import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const SCRYPT_PREFIX = '$scrypt$';

export const isHashedPassword = (stored: string): boolean => {
  if (!stored.startsWith(SCRYPT_PREFIX)) {
    return false;
  }
  const parts = stored.slice(SCRYPT_PREFIX.length).split('$');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
};

export const hashPassword = (plain: string): string => {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = scryptSync(plain, salt, KEY_LENGTH).toString('hex');
  return `${SCRYPT_PREFIX}${salt}$${derivedKey}`;
};

export const verifyPassword = (plain: string, stored?: string): boolean => {
  if (!stored) {
    return false;
  }

  if (isHashedPassword(stored)) {
    const [, , salt, expectedHex] = stored.split('$');
    if (!salt || !expectedHex || expectedHex.length % 2 !== 0) {
      return false;
    }
    const expectedBuffer = Buffer.from(expectedHex, 'hex');
    const derivedBuffer = scryptSync(plain, salt, expectedBuffer.length);
    return (
      derivedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(derivedBuffer, expectedBuffer)
    );
  }

  const plainBuffer = Buffer.from(plain, 'utf8');
  const storedBuffer = Buffer.from(stored, 'utf8');
  return (
    plainBuffer.length === storedBuffer.length &&
    timingSafeEqual(plainBuffer, storedBuffer)
  );
};
