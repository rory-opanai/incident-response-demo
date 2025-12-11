import assert from 'assert';
import { describe, test } from 'node:test';
import { validateCredentials, hashPassword } from '../src/auth.js';
import { loadRuntimeConfig } from '../src/config.js';

const email = 'demo@example.com';
const password = 'password1';

const GOOD_HASH = '8a489178fa92d4cca74f1bd8dbe5f7fd4801934d715c7d64443a46b1f618c0bf118c4cadf0bf8162e3b4c2600c812331ab70420ce7c8a1493b50ede98e497998';

describe('auth validation', () => {
  test('fails with active (broken) config after release', async () => {
    const active = await loadRuntimeConfig('active');
    const result = validateCredentials({ email, password }, active);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'invalid_password');
  });

  test('passes with good config', async () => {
    const good = await loadRuntimeConfig('good');
    const result = validateCredentials({ email, password }, good);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.user.email, email);
  });

  test('hashPassword matches stored good hash', () => {
    const computed = hashPassword(password, 'demo-day-salt-v1');
    assert.strictEqual(computed, GOOD_HASH);
  });
});
