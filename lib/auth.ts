export const MEMBER_AUTH_COOKIE = "nm_member_auth";
export const ADMIN_AUTH_COOKIE = "nm_admin_auth";
export const SESSION_MAX_AGE = 60 * 60 * 12;
type SessionRole = "member" | "admin";

function sessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Session signing secret is not configured");
  return secret;
}

async function signingKey() {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid session encoding");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), (character) => character.charCodeAt(0));
}

export async function createSessionToken(role: SessionRole) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = encode(new TextEncoder().encode(JSON.stringify({ version: 1, role, issuedAt, expiresAt: issuedAt + SESSION_MAX_AGE })));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string | undefined, role: SessionRole) {
  if (!token || token.length > 2048) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    if (!await crypto.subtle.verify("HMAC", await signingKey(), decode(signature), new TextEncoder().encode(payload))) return false;
    const session = JSON.parse(new TextDecoder().decode(decode(payload)));
    const now = Math.floor(Date.now() / 1000);
    return session.version === 1 && session.role === role && Number.isInteger(session.issuedAt) && Number.isInteger(session.expiresAt)
      && session.issuedAt <= now + 60 && session.expiresAt > now && session.expiresAt - session.issuedAt === SESSION_MAX_AGE;
  } catch {
    return false;
  }
}

function requestCookie(request: Request, name: string) {
  const item = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!item) return undefined;
  try { return decodeURIComponent(item.slice(name.length + 1)); } catch { return undefined; }
}

export async function isAdminRequest(request: Request) {
  return verifySessionToken(requestCookie(request, ADMIN_AUTH_COOKIE), "admin");
}

export async function isSignedInRequest(request: Request) {
  return await isAdminRequest(request) || await verifySessionToken(requestCookie(request, MEMBER_AUTH_COOKIE), "member");
}
