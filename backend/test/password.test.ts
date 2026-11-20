import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hashPassword,
  isHashedPassword,
  verifyPassword,
} from '../src/utils/password';

describe('password utilities', () => {
  it('should hash passwords using scrypt with unique salts', () => {
    const hashA = hashPassword('secret-pass');
    const hashB = hashPassword('secret-pass');

    assert.equal(isHashedPassword(hashA), true);
    assert.equal(isHashedPassword(hashB), true);
    assert.notEqual(hashA, hashB);
    assert.equal(hashA.startsWith('$scrypt$'), true);
  });

  it('should verify matching hashed passwords and reject mismatches', () => {
    const hashed = hashPassword('correct-horse-battery');

    assert.equal(verifyPassword('correct-horse-battery', hashed), true);
    assert.equal(verifyPassword('wrong-password', hashed), false);
    assert.equal(verifyPassword('anything', undefined), false);
    assert.equal(verifyPassword('anything', ''), false);
  });

  it('should support legacy plaintext passwords while reporting them as unhashed', () => {
    assert.equal(isHashedPassword('plaintext-123'), false);
    assert.equal(isHashedPassword('$scrypt$onlyone'), false);
    assert.equal(verifyPassword('plaintext-123', 'plaintext-123'), true);
    assert.equal(verifyPassword('other', 'plaintext-123'), false);
  });
});
