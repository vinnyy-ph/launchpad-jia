import { createCipheriv, createDecipheriv, createHash } from "crypto";

const algorithm = "aes-256-cbc";
const BASE_SECRET = "jia-candidate-profile-secret";

function deriveKeyMaterial(profileId: string) {
  const digest = createHash("sha256").update(profileId + BASE_SECRET).digest();
  const key = digest.subarray(0, 32);
  const iv = digest.subarray(0, 16);
  return { key, iv };
}

export function decryptPasscode(encrypted: string, profileId: string): string {
  const { key, iv } = deriveKeyMaterial(profileId);
  const decipher = createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function encryptPasscode(passcode: string, profileId: string): string {
  const { key, iv } = deriveKeyMaterial(profileId);
  const cipher = createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(passcode, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}
