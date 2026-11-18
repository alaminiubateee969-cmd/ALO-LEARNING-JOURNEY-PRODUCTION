const PHONE_E164 = /^\+[1-9]\d{6,14}$/;

/**
 * SMS OTP is a second factor for the single administrator account.
 *
 * It is mandatory in production unless the operator deliberately sets
 * `ADMIN_OTP_REQUIRED=false`. That opt-out is an explicit owner decision (used
 * while no SMS provider is configured) and removes the second factor, so it
 * must be paired with a strong `ADMIN_PASSWORD_HASH`. Any other value —
 * including unset — keeps production on the mandatory path.
 */
export function isAdminOtpRequired(): boolean {
  if (process.env.ADMIN_OTP_REQUIRED === "false") return false;
  return process.env.NODE_ENV === "production" || process.env.ADMIN_OTP_REQUIRED === "true";
}

export function isAdminOtpDeliveryConfigured(): boolean {
  const recipient = process.env.ADMIN_OTP_PHONE?.trim() ?? "";
  const sender = process.env.HTTPSMS_FROM?.trim() ?? "";
  const apiKey = process.env.HTTPSMS_API_KEY?.trim() ?? "";
  const base = process.env.HTTPSMS_BASE_URL?.trim() || "https://api.httpsms.com";
  if (!PHONE_E164.test(recipient) || !PHONE_E164.test(sender) || !apiKey) return false;

  try {
    const url = new URL(base);
    return (url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:")) &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function isAdminAuthenticationConfigured(): boolean {
  const passwordHash = process.env.ADMIN_PASSWORD_HASH ?? "";
  const passwordAuthenticationReady = Boolean(
    process.env.NEXTAUTH_SECRET &&
      process.env.ADMIN_EMAIL?.trim() &&
      /^scrypt\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/.test(passwordHash)
  );
  return passwordAuthenticationReady && (!isAdminOtpRequired() || isAdminOtpDeliveryConfigured());
}
