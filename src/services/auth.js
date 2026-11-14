// Sign-up and log-in rules (U01). Pure functions: no database, no Express.
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const b64 = (v) => Buffer.from(v).toString('base64url');
const SCRYPT = { N: 16384, r: 8, p: 1 };
// Async on purpose: scryptSync blocked the whole server during every log-in, so a burst of attempts
// stalled everyone. Hashing is one-way: a password can be checked, never recovered.
const scryptAsync = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64url');
  const got = await scryptAsync(String(password), Buffer.from(salt, 'base64url'), 64, SCRYPT);
  return want.length === got.length && timingSafeEqual(want, got);
}

// HS256 JWT. Small enough that a library would add more code than it saves.
const sign = (data, secret) => createHmac('sha256', secret).update(data).digest('base64url');
export const TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days (PRD-UO1)

export function signToken(sub, secret, now = Math.floor(Date.now() / 1000)) {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(
    JSON.stringify({ sub, role: 'resident', purpose: 'access', iat: now, exp: now + TOKEN_TTL }),
  );
  return `${head}.${body}.${sign(`${head}.${body}`, secret)}`;
}

// Returns the payload, or null for anything that is not a valid, unexpired access token.
export function verifyToken(token, secret, now = Math.floor(Date.now() / 1000)) {
  const [head, body, sig, extra] = String(token).split('.');
  if (!head || !body || !sig || extra !== undefined) return null;
  const want = Buffer.from(sign(`${head}.${body}`, secret));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    // The header is checked too, so a token made for another algorithm is never accepted.
    if (JSON.parse(Buffer.from(head, 'base64url')).alg !== 'HS256') return null;
    const p = JSON.parse(Buffer.from(body, 'base64url'));
    return p.purpose === 'access' && typeof p.sub === 'string' && p.exp > now ? p : null;
  } catch {
    return null;
  }
}

// One stored form per number, or 0917... and +63917... would both pass the UNIQUE check.
// PH mobiles only for now (open item 17). Returns +639XXXXXXXXX or null.
export function normalizeMobile(input) {
  const d = String(input ?? '').replace(/[\s\-()]/g, '');
  const m = /^(?:\+?63|0)?(9\d{9})$/.exec(d);
  return m ? `+63${m[1]}` : null;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_HELP = 'Enter a Philippine mobile number, like 0917 123 4567.';
// PRD-UO1: 8+ characters, an uppercase letter, a number and a special character.
const strong = (p) =>
  p.length >= 8 && p.length <= 200 && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);

// Returns { value } when the body is valid, or { fields } naming each bad field.
export function validateRegister(body) {
  const b = body ?? {};
  const fields = {};
  const email = str(b.email).toLowerCase();
  const full_name = str(b.full_name);
  const mobile_number = normalizeMobile(b.mobile_number);
  const password = typeof b.password === 'string' ? b.password : '';
  if (!EMAIL.test(email) || email.length > 254) fields.email = 'Enter a valid email address.';
  if (!full_name || full_name.length > 100) fields.full_name = 'Enter your full name.';
  if (!mobile_number) fields.mobile_number = MOBILE_HELP;
  if (!strong(password))
    fields.password =
      'Use at least 8 characters with an uppercase letter, a number and a special character.';
  return Object.keys(fields).length
    ? { fields }
    : { value: { email, full_name, mobile_number, password } };
}

// Profile edit (U02): any of full_name, email, mobile_number, with the sign-up rules. Password change
// is not part of it. Returns { value } holding only the fields sent, or { fields }.
export function validateProfile(body) {
  const b = body ?? {};
  const fields = {};
  const value = {};
  if (b.full_name !== undefined) {
    value.full_name = str(b.full_name);
    if (!value.full_name || value.full_name.length > 100)
      fields.full_name = 'Enter your full name.';
  }
  if (b.email !== undefined) {
    value.email = str(b.email).toLowerCase();
    if (!EMAIL.test(value.email) || value.email.length > 254)
      fields.email = 'Enter a valid email address.';
  }
  if (b.mobile_number !== undefined) {
    value.mobile_number = normalizeMobile(b.mobile_number);
    if (!value.mobile_number) fields.mobile_number = MOBILE_HELP;
  }
  if (!Object.keys(fields).length && !Object.keys(value).length)
    fields.full_name = 'Send at least one of full_name, email, mobile_number.';
  return Object.keys(fields).length ? { fields } : { value };
}

// Log in with a mobile number (Figma) or an email (U01 spec). Open item 25.
export function validateLogin(body) {
  const b = body ?? {};
  const fields = {};
  const email = str(b.email).toLowerCase();
  const mobile_number = normalizeMobile(b.mobile_number);
  const password = typeof b.password === 'string' ? b.password : '';
  if (b.mobile_number !== undefined && !mobile_number) fields.mobile_number = MOBILE_HELP;
  else if (!mobile_number && !EMAIL.test(email))
    fields.email = 'Enter your mobile number or email address.';
  if (!password || password.length > 200) fields.password = 'Enter your password.';
  if (Object.keys(fields).length) return { fields };
  return { value: mobile_number ? { mobile_number, password } : { email, password } };
}
