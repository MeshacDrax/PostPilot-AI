import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ApiError } from "../utils/http";

function encryptionKey() {
  const secret = process.env.AI_CREDENTIALS_SECRET?.trim();
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) {
    throw new ApiError(
      503,
      "AI key encryption is not configured. Set AI_CREDENTIALS_SECRET to a 64-character hex secret on the server.",
    );
  }
  return Buffer.from(secret, "hex");
}

export function encryptAiApiKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptAiApiKey(payload: string) {
  const [version, ivHex, tagHex, encryptedHex, ...extra] = payload.split(":");
  if (version !== "v1" || !ivHex || !tagHex || !encryptedHex || extra.length) {
    throw new ApiError(503, "The saved AI connection is invalid. Remove it and configure the connection again.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "The saved AI connection could not be decrypted. Check that AI_CREDENTIALS_SECRET has not changed.",
    );
  }
}
