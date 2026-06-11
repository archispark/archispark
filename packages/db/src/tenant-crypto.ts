/**
 * Symmetric encryption for tenant database connection strings (AES-256-GCM).
 *
 * `tenant_databases.connection_string_encrypted` (see schema.control.ts) holds
 * the output of `encryptConnectionString`. The key is derived from
 * `TENANT_DB_ENCRYPTION_KEY` (any passphrase, stretched via scrypt) — set this
 * env var wherever `getTenantDb` or the Phase 3 provisioning script run.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(): Buffer {
  const secret = process.env["TENANT_DB_ENCRYPTION_KEY"];
  if (!secret) throw new Error("TENANT_DB_ENCRYPTION_KEY is required to encrypt/decrypt tenant connection strings");
  return scryptSync(secret, "archispark-tenant-db", 32);
}

/** Encrypts a tenant Postgres connection string for storage in `tenant_databases`. */
export function encryptConnectionString(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

/** Reverses `encryptConnectionString`. */
export function decryptConnectionString(encrypted: string): string {
  const key = deriveKey();
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
