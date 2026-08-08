import type { HouseholdMember } from '../../shared/models';
import { error, type Env } from './http';

export const SESSION_COOKIE = 'wariatkowo_session';
export const PIN_ITERATIONS = 210_000;
const encoder = new TextEncoder();

type MemberAuthRow = HouseholdMember & {
  pin_hash: string | null;
  pin_salt: string | null;
  pin_iterations: number | null;
};
export type AuthenticatedSession = { member: HouseholdMember; sessionId: string };

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(value: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return new Uint8Array();
  return new Uint8Array(value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}
export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}
export async function sha256(value: string): Promise<string> {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
export async function derivePinHash(pin: string, saltHex: string, iterations = PIN_ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex).buffer as ArrayBuffer, iterations }, key, 256,
  );
  return bytesToHex(new Uint8Array(bits));
}
export function constantTimeEqual(first: string, second: string): boolean {
  if (first.length !== second.length) return false;
  let mismatch = 0;
  for (let index = 0; index < first.length; index += 1) {
    mismatch |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return mismatch === 0;
}
export async function verifyMemberPin(member: MemberAuthRow, pin: string): Promise<boolean> {
  if (!member.pin_hash || !member.pin_salt || !member.pin_iterations) return false;
  return constantTimeEqual(await derivePinHash(pin, member.pin_salt, member.pin_iterations), member.pin_hash);
}
export function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}
export async function getAuthenticatedSession(request: Request, env: Env): Promise<AuthenticatedSession | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT s.id AS session_id, m.id, m.name, m.slug FROM sessions s JOIN household_members m ON m.id = s.member_id WHERE s.token_hash = ? AND s.expires_at > ?',
  ).bind(await sha256(token), new Date().toISOString()).first<{
    session_id: string; id: string; name: string; slug: 'misiek' | 'miska';
  }>();
  return row ? { sessionId: row.session_id, member: { id: row.id, name: row.name, slug: row.slug } } : null;
}
export async function requireAuth(request: Request, env: Env): Promise<AuthenticatedSession | Response> {
  return (await getAuthenticatedSession(request, env)) ?? error('UNAUTHORIZED', 'Zaloguj się, aby wejść do Wariatkowa.', 401);
}
export function isAuthResponse(value: AuthenticatedSession | Response): value is Response {
  return value instanceof Response;
}
export function createSessionCookie(token: string, expiresAt: Date): string {
  return [
    SESSION_COOKIE + '=' + encodeURIComponent(token), 'Path=/', 'HttpOnly', 'Secure',
    'SameSite=Lax', 'Expires=' + expiresAt.toUTCString(),
  ].join('; ');
}
export function clearSessionCookie(): string {
  return SESSION_COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}
export function createSessionExpiry(): Date {
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + 30);
  return expires;
}
export async function loadMemberForLogin(env: Env, memberId: string): Promise<MemberAuthRow | null> {
  return env.DB.prepare(
    'SELECT id, name, slug, pin_hash, pin_salt, pin_iterations FROM household_members WHERE id = ?',
  ).bind(memberId).first<MemberAuthRow>();
}
