import { SignJWT, importPKCS8, createRemoteJWKSet, jwtVerify } from "jose";

export const appleConfigured = (env) =>
  Boolean(
    env.APPLE_CLIENT_ID &&
      env.APPLE_TEAM_ID &&
      env.APPLE_KEY_ID &&
      env.APPLE_PRIVATE_KEY &&
      env.APPLE_TOKEN_ENCRYPTION_KEY &&
      env.PUBLIC_ORIGIN?.startsWith("https://"),
  );
export async function appleClientSecret(env) {
  const key = await importPKCS8(
    env.APPLE_PRIVATE_KEY.replaceAll("\\n", "\n"),
    "ES256",
  );
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID })
    .setIssuer(env.APPLE_TEAM_ID)
    .setSubject(env.APPLE_CLIENT_ID)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}
export async function verifyAppleIDToken(token, { clientId, nonce, keySet }) {
  const keys =
    keySet ||
    createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"), {
      timeoutDuration: 7000,
    });
  const { payload } = await jwtVerify(token, keys, {
    issuer: "https://appleid.apple.com",
    audience: clientId,
    algorithms: ["RS256"],
    clockTolerance: 30,
    maxTokenAge: "10m",
  });
  if (
    payload.nonce !== nonce ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.sub.length > 255 ||
    ![true, "true"].includes(payload.email_verified) ||
    typeof payload.email !== "string" ||
    !payload.email.includes("@") ||
    payload.email.length > 254
  )
    throw Error("APPLE_TOKEN_INVALID");
  return { sub: payload.sub, email: payload.email.toLowerCase() };
}
async function encryptionKey(env) {
  const bytes = Buffer.from(env.APPLE_TOKEN_ENCRYPTION_KEY || "", "base64");
  if (bytes.length !== 32) throw Error("APPLE_NOT_CONFIGURED");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function encryptAppleGrant(env, userId, refreshToken) {
  if (
    typeof refreshToken !== "string" ||
    !refreshToken ||
    refreshToken.length > 8192
  )
    throw Error("APPLE_AUTH_FAILED");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(userId) },
    await encryptionKey(env),
    new TextEncoder().encode(refreshToken),
  );
  return (
    Buffer.from(iv).toString("base64") +
    "." +
    Buffer.from(encrypted).toString("base64")
  );
}
export async function storeAppleGrant(env, userId, refreshToken) {
  const encrypted = await encryptAppleGrant(env, userId, refreshToken);
  await env.IDENTITY.prepare(
    "INSERT INTO apple_grants(user_id,token) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET token=excluded.token",
  )
    .bind(userId, encrypted)
    .run();
}
export async function revokeAppleGrant(env, userId) {
  const grant = await env.IDENTITY.prepare(
    "SELECT token FROM apple_grants WHERE user_id=?",
  )
    .bind(userId)
    .first();
  if (!grant) return;
  const [iv, encrypted] = grant.token.split(".");
  const token = new TextDecoder().decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: Buffer.from(iv, "base64"),
        additionalData: new TextEncoder().encode(userId),
      },
      await encryptionKey(env),
      Buffer.from(encrypted, "base64"),
    ),
  );
  const response = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.APPLE_CLIENT_ID,
      client_secret: await appleClientSecret(env),
      token,
      token_type_hint: "refresh_token",
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw Object.assign(Error("APPLE_REVOCATION_FAILED"), { status: 503 });
}
