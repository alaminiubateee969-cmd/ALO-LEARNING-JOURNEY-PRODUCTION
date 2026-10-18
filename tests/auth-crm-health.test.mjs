import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAdminAuthenticationConfigured, isAdminOtpDeliveryConfigured, isAdminOtpRequired } from "../src/lib/auth-config.ts";

const envNames = [
  "NODE_ENV",
  "ADMIN_OTP_REQUIRED",
  "ADMIN_OTP_PHONE",
  "HTTPSMS_FROM",
  "HTTPSMS_API_KEY",
  "HTTPSMS_BASE_URL",
  "NEXTAUTH_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD_HASH",
];

function withEnv(values, run) {
  const previous = new Map(envNames.map((name) => [name, process.env[name]]));
  for (const name of envNames) delete process.env[name];
  Object.assign(process.env, values);
  try {
    return run();
  } finally {
    for (const name of envNames) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("administrator OTP is mandatory in production and opt-in elsewhere", () => {
  withEnv({ NODE_ENV: "production" }, () => assert.equal(isAdminOtpRequired(), true));
  withEnv({ NODE_ENV: "development" }, () => assert.equal(isAdminOtpRequired(), false));
  withEnv({ NODE_ENV: "test", ADMIN_OTP_REQUIRED: "true" }, () => assert.equal(isAdminOtpRequired(), true));
});

test("production administrator auth fails closed until valid SMS delivery settings exist", () => {
  const credentials = {
    NODE_ENV: "production",
    NEXTAUTH_SECRET: "test-only-secret-not-for-production",
    ADMIN_EMAIL: "admin@example.test",
    ADMIN_PASSWORD_HASH: `scrypt$${"a".repeat(22)}$${"b".repeat(86)}`,
  };
  withEnv(credentials, () => assert.equal(isAdminAuthenticationConfigured(), false));
  withEnv({
    ...credentials,
    ADMIN_OTP_PHONE: "+8801712345678",
    HTTPSMS_FROM: "+12345678901",
    HTTPSMS_API_KEY: "test-only-not-a-real-provider-key",
    HTTPSMS_BASE_URL: "https://api.httpsms.com",
  }, () => {
    assert.equal(isAdminOtpDeliveryConfigured(), true);
    assert.equal(isAdminAuthenticationConfigured(), true);
  });
});

test("OTP delivery configuration rejects insecure or malformed provider endpoints", () => {
  const valid = {
    NODE_ENV: "production",
    ADMIN_OTP_PHONE: "+8801712345678",
    HTTPSMS_FROM: "+12345678901",
    HTTPSMS_API_KEY: "test-only",
  };
  withEnv({ ...valid, HTTPSMS_BASE_URL: "http://api.httpsms.com" }, () => assert.equal(isAdminOtpDeliveryConfigured(), false));
  withEnv({ ...valid, ADMIN_OTP_PHONE: "01712345678", HTTPSMS_BASE_URL: "https://api.httpsms.com" }, () => assert.equal(isAdminOtpDeliveryConfigured(), false));
  withEnv({ ...valid, HTTPSMS_BASE_URL: "https://user:password@example.test" }, () => assert.equal(isAdminOtpDeliveryConfigured(), false));
});

test("generic OTP route is disabled and cannot generate, store, or return a simulated code", () => {
  const source = readFileSync(new URL("../src/app/api/otp/route.ts", import.meta.url), "utf8");
  const post = source.slice(source.indexOf("export async function POST"));
  assert.match(post, /otp_delivery_not_configured/);
  assert.match(post, /No code was generated or stored/);
  assert.doesNotMatch(post, /randomInt|randomBytes|otpRequest\.create|sendOtp|generateOtp/i);
});

test("CRM workspace selection is admin-protected and not mistaken for membership authorization", () => {
  const helper = readFileSync(new URL("../src/lib/crm-server.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../src/components/alo/ApiReferenceView.tsx", import.meta.url), "utf8");
  assert.match(helper, /await requireOwner\(\)/);
  assert.match(helper, /x-alo-company-id/);
  assert.match(ui, /not a membership token or authorization boundary/);
  assert.match(readFileSync(new URL("../src/app/api/crm/leads/route.ts", import.meta.url), "utf8"), /companyId:\s*scope\.companyId/);
});

test("health route exposes release identity, requires MySQL/admin setup in production, and redacts DB host", () => {
  const source = readFileSync(new URL("../src/app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(source, /releaseSha/);
  assert.match(source, /production requires MySQL/);
  assert.match(source, /isAdminAuthenticationConfigured/);
  assert.match(source, /host redacted/);
});
