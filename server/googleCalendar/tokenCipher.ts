import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function decodeKey(value: string): Buffer {
  const trimmed = value.trim();
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  try {
    return Buffer.from(trimmed, "base64url");
  } catch {
    return Buffer.alloc(0);
  }
}

export interface TokenCipher {
  encrypt(value: string): string;
  decrypt(value: string): string;
}

export class AesGcmTokenCipher implements TokenCipher {
  private readonly key: Buffer;

  constructor(encodedKey: string | undefined) {
    if (!encodedKey?.trim()) {
      throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is required.");
    }
    this.key = decodeKey(encodedKey);
    if (this.key.length !== 32) {
      throw new Error(
        "GOOGLE_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64url or 64 hex characters).",
      );
    }
  }

  encrypt(value: string): string {
    if (!value)
      throw new Error("Cannot encrypt an empty Google refresh token.");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  decrypt(value: string): string {
    const [version, ivValue, tagValue, ciphertextValue, extra] =
      value.split(".");
    if (
      version !== VERSION ||
      !ivValue ||
      !tagValue ||
      !ciphertextValue ||
      extra
    ) {
      throw new Error("Stored Google refresh token has an invalid format.");
    }
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(ivValue, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new Error("Stored Google refresh token could not be decrypted.");
    }
  }
}
