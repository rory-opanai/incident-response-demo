import crypto from 'crypto';
import { loadRuntimeConfig } from './config.js';

export function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function validateCredentials({ email, password }, config) {
  const runtime = config ?? {};
  const { auth = {}, releaseTag } = runtime;
  const { salt, users = [] } = auth;
  const user = users.find((u) => u.email === email);

  if (!user) {
    return { ok: false, reason: 'unknown_user', releaseTag };
  }
  if (!salt) {
    return { ok: false, reason: 'missing_salt', releaseTag };
  }

  const computed = hashPassword(password, salt);
  const ok = computed === user.passwordHash;

  return ok
    ? { ok: true, user: { email: user.email, role: user.role }, releaseTag }
    : { ok: false, reason: 'invalid_password', releaseTag };
}

export async function checkLogin(email, password, configName = 'active') {
  const config = await loadRuntimeConfig(configName);
  return validateCredentials({ email, password }, config);
}
