// HMAC-SHA256 request signing shared by both directions of the n8n integration.
//
//   X-LendLoop-Timestamp: unix seconds
//   X-LendLoop-Signature: hex(HMAC_SHA256(secret, `${timestamp}.${rawBody}`))
//
// The timestamp is inside the signed string, and requests older than
// MAX_SKEW_SECONDS are rejected, so a captured request can't be replayed later.

export const TIMESTAMP_HEADER = "X-LendLoop-Timestamp";
export const SIGNATURE_HEADER = "X-LendLoop-Signature";
const MAX_SKEW_SECONDS = 300;

const encoder = new TextEncoder();

async function importKey(secret: string) {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export async function sign(
  secret: string,
  body: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const key = await importKey(secret);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  return { timestamp: String(timestamp), signature: toHex(mac) };
}

export async function verify(
  secret: string,
  body: string,
  timestamp: string | null,
  signature: string | null,
  now = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  const sigBytes = fromHex(signature);
  if (!sigBytes) return false;
  const key = await importKey(secret);
  // subtle.verify compares in constant time, unlike `===` on hex strings.
  return await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as Uint8Array<ArrayBuffer>,
    encoder.encode(`${timestamp}.${body}`),
  );
}
