import { describe, it, expect, afterEach } from "vitest";
import { encryptConnectionString, decryptConnectionString } from "./tenant-crypto.js";

const ORIGINAL_KEY = process.env["TENANT_DB_ENCRYPTION_KEY"];

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env["TENANT_DB_ENCRYPTION_KEY"];
  else process.env["TENANT_DB_ENCRYPTION_KEY"] = ORIGINAL_KEY;
});

describe("encryptConnectionString / decryptConnectionString", () => {
  it("round-trips a connection string", () => {
    process.env["TENANT_DB_ENCRYPTION_KEY"] = "test-secret-key";
    const plaintext = "postgresql://user:pass@ep-test.us-east-2.aws.neon.tech/dbname?sslmode=require";
    const encrypted = encryptConnectionString(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptConnectionString(encrypted)).toBe(plaintext);
  });

  it("uses a random IV, so encrypting twice yields different output", () => {
    process.env["TENANT_DB_ENCRYPTION_KEY"] = "test-secret-key";
    const plaintext = "postgresql://user:pass@ep-test.us-east-2.aws.neon.tech/dbname";
    expect(encryptConnectionString(plaintext)).not.toBe(encryptConnectionString(plaintext));
  });

  it("throws when TENANT_DB_ENCRYPTION_KEY is not set", () => {
    delete process.env["TENANT_DB_ENCRYPTION_KEY"];
    expect(() => encryptConnectionString("postgresql://user:pass@host/db")).toThrow(/TENANT_DB_ENCRYPTION_KEY/);
    expect(() => decryptConnectionString("AAAA")).toThrow(/TENANT_DB_ENCRYPTION_KEY/);
  });

  it("fails to decrypt when the key changes (auth tag mismatch)", () => {
    process.env["TENANT_DB_ENCRYPTION_KEY"] = "key-one";
    const encrypted = encryptConnectionString("postgresql://user:pass@host/db");
    process.env["TENANT_DB_ENCRYPTION_KEY"] = "key-two";
    expect(() => decryptConnectionString(encrypted)).toThrow();
  });
});
