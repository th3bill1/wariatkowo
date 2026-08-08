import {
  createSessionCookie,
  createSessionExpiry,
  isValidPin,
  loadMemberForLogin,
  sha256,
  verifyMemberPin,
} from "../../_shared/auth";
import {
  error,
  methodNotAllowed,
  nowIso,
  readJsonBody,
  success,
  type Env,
} from "../../_shared/http";

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;

function clientIdentity(request: Request): string {
  return (
    (request.headers.get("CF-Connecting-IP") ?? "unknown") +
    "|" +
    (request.headers.get("User-Agent") ?? "unknown")
  );
}
export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  if (context.request.method !== "POST") return methodNotAllowed(["POST"]);
  let body: unknown;
  try {
    body = await readJsonBody(context.request);
  } catch {
    return error(
      "VALIDATION_ERROR",
      "Nie udało się zalogować. Sprawdź profil i PIN.",
    );
  }
  const input = body as { memberId?: unknown; pin?: unknown };
  if (typeof input.memberId !== "string" || !isValidPin(input.pin)) {
    return error(
      "UNAUTHORIZED",
      "Nie udało się zalogować. Sprawdź profil i PIN.",
      401,
    );
  }

  const clientHash = await sha256(clientIdentity(context.request));
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const failures = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM login_attempts WHERE member_key = ? AND client_hash = ? AND succeeded = 0 AND attempted_at >= ?",
  )
    .bind(await sha256(input.memberId), clientHash, since)
    .first<{ count: number }>();
  if ((failures?.count ?? 0) >= MAX_FAILURES) {
    return error(
      "RATE_LIMITED",
      "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
      429,
    );
  }

  const member = await loadMemberForLogin(context.env, input.memberId);
  const valid = member ? await verifyMemberPin(member, input.pin) : false;
  const timestamp = nowIso();
  await context.env.DB.prepare(
    "INSERT INTO login_attempts (member_key, client_hash, attempted_at, succeeded) VALUES (?, ?, ?, ?)",
  )
    .bind(await sha256(input.memberId), clientHash, timestamp, valid ? 1 : 0)
    .run();

  if (!member || !valid) {
    return error(
      "UNAUTHORIZED",
      "Nie udało się zalogować. Sprawdź profil i PIN.",
      401,
    );
  }

  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = createSessionExpiry();
  await context.env.DB.batch([
    context.env.DB.prepare(
      "INSERT INTO sessions (id, token_hash, member_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(
      crypto.randomUUID(),
      await sha256(token),
      member.id,
      expiresAt.toISOString(),
      timestamp,
      timestamp,
    ),
    context.env.DB.prepare(
      "DELETE FROM login_attempts WHERE attempted_at < ?",
    ).bind(new Date(Date.now() - 24 * 60 * 60_000).toISOString()),
  ]);

  return success(
    { id: member.id, name: member.name, slug: member.slug },
    { headers: { "Set-Cookie": createSessionCookie(token, expiresAt) } },
  );
}
