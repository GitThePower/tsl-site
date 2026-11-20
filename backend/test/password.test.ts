import {
  hashPassword,
  isHashedPassword,
  verifyPassword,
} from '../src/utils/password';

describe('password utilities', () => {
  it('should hash passwords using scrypt with unique salts', () => {
    const hashA = hashPassword('secret-pass');
    const hashB = hashPassword('secret-pass');

    expect(isHashedPassword(hashA)).toBe(true);
    expect(isHashedPassword(hashB)).toBe(true);
    expect(hashA).not.toBe(hashB);
    expect(hashA.startsWith('$scrypt$')).toBe(true);
  });

  it('should verify matching hashed passwords and reject mismatches', () => {
    const hashed = hashPassword('correct-horse-battery');

    expect(verifyPassword('correct-horse-battery', hashed)).toBe(true);
    expect(verifyPassword('wrong-password', hashed)).toBe(false);
    expect(verifyPassword('anything', undefined)).toBe(false);
    expect(verifyPassword('anything', '')).toBe(false);
  });

  it('should support legacy plaintext passwords while reporting them as unhashed', () => {
    expect(isHashedPassword('plaintext-123')).toBe(false);
    expect(isHashedPassword('$scrypt$onlyone')).toBe(false);
    expect(verifyPassword('plaintext-123', 'plaintext-123')).toBe(true);
    expect(verifyPassword('other', 'plaintext-123')).toBe(false);
  });
});
