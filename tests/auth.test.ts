import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  createSessionCookie,
  derivePinHash,
  isValidPin,
} from "../functions/_shared/auth";

describe("household PIN security", () => {
  it("accepts exactly four digits", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });
  it("derives stable, salt-specific hashes", async () => {
    const first = await derivePinHash(
      "1234",
      "00112233445566778899aabbccddeeff",
      1000,
    );
    const repeat = await derivePinHash(
      "1234",
      "00112233445566778899aabbccddeeff",
      1000,
    );
    const other = await derivePinHash(
      "1234",
      "ffeeddccbbaa99887766554433221100",
      1000,
    );
    expect(first).toBe(repeat);
    expect(first).not.toBe(other);
    expect(constantTimeEqual(first, repeat)).toBe(true);
  });
  it("creates a hardened same-origin cookie", () => {
    const cookie = createSessionCookie(
      "secret",
      new Date("2030-01-01T00:00:00Z"),
    );
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });
});
