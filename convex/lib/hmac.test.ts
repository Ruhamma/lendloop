import { describe, expect, test } from "vitest";
import { sign, verify } from "./hmac";

const SECRET = "test-secret";
const BODY = JSON.stringify({ loanId: "abc", status: "sent" });

describe("hmac", () => {
  test("accepts a fresh, correctly signed body", async () => {
    const { timestamp, signature } = await sign(SECRET, BODY);
    expect(await verify(SECRET, BODY, timestamp, signature)).toBe(true);
  });

  test("rejects a tampered body, a wrong secret, or a malformed signature", async () => {
    const { timestamp, signature } = await sign(SECRET, BODY);
    expect(await verify(SECRET, BODY.replace("sent", "failed"), timestamp, signature)).toBe(false);
    expect(await verify("other-secret", BODY, timestamp, signature)).toBe(false);
    expect(await verify(SECRET, BODY, timestamp, "not-hex")).toBe(false);
    expect(await verify(SECRET, BODY, null, signature)).toBe(false);
  });

  test("rejects replays older than five minutes", async () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
    const { timestamp, signature } = await sign(SECRET, BODY, tenMinutesAgo);
    expect(await verify(SECRET, BODY, timestamp, signature)).toBe(false);
  });
});
