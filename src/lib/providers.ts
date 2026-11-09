/**
 * Provider Registry — declarative catalog of every integration MarketingOS
 * supports. Each entry describes:
 *   - OAuth endpoints (authorize + token + refresh)
 *   - Required scopes for the resource-discovery API surface
 *   - Whether PKCE is supported
 *   - Whether manual credentials are an option (when no OAuth exists)
 *   - How to discover resources (which provider API to call)
 *
 * The registry is the single source of truth for the v1 integration API.
 * Adding a provider = adding an entry here; the routes pick it up.
 *
 * Patterns borrowed from:
 *   - Postiz (https://github.com/gitroomhq/postiz-app) — provider config shape
 *   - nuxt/scripts (https://github.com/nuxt/scripts) — script-loading rules
 *   - OAuth 2.0 RFC 6749 + PKCE RFC 7636
 *
 * No secrets live here — only well-known public endpoints and scope lists.
 * Per-tenant client_id/client_secret come from env vars named in
 * `clientIdEnv` / `clientSecretEnv` and are read at runtime.
 */

export type AuthMethod = 'oauth' | 'manual' | 'both';
export type ResourceDiscoverer =
  | 'google_search_console'
  | 'google_youtube'
  | 'google_ga4'
  | 'google_gtm'
  | 'google_ads'
  | 'google_business'
  | 'meta_pages'
  | 'meta_ad_accounts'
  | 'meta_pixels'
  | 'meta_whatsapp'
  | 'linkedin_organizations'
  | 'linkedin_ad_accounts'
  | 'x_account'
  | 'tiktok_account'
  | 'pinterest_boards'
  | 'wordpress_site'
  | 'shopify_store'
  | 'stripe_account'
  | 'hubspot_account'
  | 'mailchimp_audiences'
  | 'sendgrid_sender_identities';

export interface ProviderDefinition {
  /** Canonical slug used in URLs and stored in DB */
  slug: string;
  /** Human-readable name shown in the UI */
  label: string;
  /** MarketingOS category for grouping */
  category: 'google' | 'social' | 'crm' | 'ecommerce' | 'email' | 'analytics' | 'seo' | 'marketplace' | 'other';
  /** Connection method supported */
  authMethod: AuthMethod;
  /** OAuth authorize URL (provider-hosted) */
  authorizeUrl?: string;
  /** OAuth token exchange URL (server-to-server) */
  tokenUrl?: string;
  /** OAuth scopes required for the discovery API surface to work */
  scopes: string[];
  /** Whether PKCE (RFC 7636) is supported */
  supportsPkce: boolean;
  /** Env var holding the OAuth client_id */
  clientIdEnv?: string;
  /** Env var holding the OAuth client_secret */
  clientSecretEnv?: string;
  /** Resource discovery strategy — which provider API surface to call */
  discoverer: ResourceDiscoverer;
  /** Documentation URL for the provider's developer portal */
  docsUrl: string;
  /** Fields the user must supply manually (manual authMethod only) */
  manualFields?: ManualCredentialField[];
}

export interface ManualCredentialField {
  /** Field name as stored in IntegrationSecret.kind */
  name: string;
  label: string;
  /** Whether the value is secret (encrypt) or non-secret (store plain) */
  secret: boolean;
  required: boolean;
  /** Help text shown to the user explaining where to obtain the value */
  helpText: string;
  placeholder?: string;
}

export const PROVIDERS: Record<string, ProviderDefinition> = {
  // ─── GOOGLE (multiple resource discoverers, one OAuth connection) ────────────
  google: {
    slug: 'google',
    label: 'Google (Search Console, YouTube, GA4, GTM, Ads, Business Profile)',
    category: 'google',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/webmasters.readonly', // Search Console
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/analytics.readonly', // GA4
      'https://www.googleapis.com/auth/tagmanager.readonly', // GTM
      'https://www.googleapis.com/auth/adwords', // Google Ads
      'https://www.googleapis.com/auth/business.manage', // Business Profile
      'openid',
      'email',
    ],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_search_console', // primary; discover() fans out to all
    docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
  },

  youtube: {
    slug: 'youtube',
    label: 'YouTube (standalone)',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_youtube',
    docsUrl: 'https://developers.google.com/youtube/v3/guides/auth/installed-apps',
  },

  // ─── META (Facebook + Instagram + WhatsApp + Ads) ───────────────────────────
  meta: {
    slug: 'meta',
    label: 'Meta (Facebook, Instagram, WhatsApp, Ads)',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_messaging',
      'instagram_basic',
      'instagram_manage_insights',
      'instagram_content_publish',
      'business_management',
      'ads_management',
      'ads_read',
      'whatsapp_business_messaging',
    ],
    supportsPkce: false, // Meta does not implement RFC 7636
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    discoverer: 'meta_pages',
    docsUrl: 'https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow',
  },

  // ─── LINKEDIN ──────────────────────────────────────────────────────────────
  linkedin: {
    slug: 'linkedin',
    label: 'LinkedIn',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['r_liteprofile', 'r_organization_social', 'rw_organization_admin', 'r_ads', 'r_organization_social'],
    supportsPkce: true,
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    discoverer: 'linkedin_organizations',
    docsUrl: 'https://learn.microsoft.com/linkedin/shared/authentication/authorization-code-flow',
  },

  // ─── X / TWITTER ────────────────────────────────────────────────────────────
  x: {
    slug: 'x',
    label: 'X (Twitter)',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'users.read', 'offline.access'],
    supportsPkce: true,
    clientIdEnv: 'X_CLIENT_ID',
    clientSecretEnv: 'X_CLIENT_SECRET',
    discoverer: 'x_account',
    docsUrl: 'https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code',
  },

  // ─── TIKTOK ────────────────────────────────────────────────────────────────
  tiktok: {
    slug: 'tiktok',
    label: 'TikTok for Business',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.list', 'video.publish'],
    supportsPkce: true,
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    discoverer: 'tiktok_account',
    docsUrl: 'https://developers.tiktok.com/doc/login-kit-web/',
  },

  // ─── PINTEREST ─────────────────────────────────────────────────────────────
  pinterest: {
    slug: 'pinterest',
    label: 'Pinterest',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    scopes: ['boards:read', 'pins:read', 'pins:write'],
    supportsPkce: true,
    clientIdEnv: 'PINTEREST_APP_ID',
    clientSecretEnv: 'PINTEREST_APP_SECRET',
    discoverer: 'pinterest_boards',
    docsUrl: 'https://developers.pinterest.com/docs/getting-started/introduction/',
  },

  // ─── WORDPRESS (application password — manual) ──────────────────────────────
  wordpress: {
    slug: 'wordpress',
    label: 'WordPress',
    category: 'other',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'wordpress_site',
    docsUrl: 'https://developer.wordpress.org/rest-api/using-the-rest-api/application-passwords/',
    manualFields: [
      {
        name: 'site_url',
        label: 'Site URL',
        secret: false,
        required: true,
        helpText: 'Your WordPress site root URL (e.g. https://blog.example.com).',
        placeholder: 'https://blog.example.com',
      },
      {
        name: 'username',
        label: 'WordPress Username',
        secret: false,
        required: true,
        helpText: 'The WordPress user whose Application Password you generated.',
        placeholder: 'api-user',
      },
      {
        name: 'application_password',
        label: 'Application Password',
        secret: true,
        required: true,
        helpText:
          'Generate one under WP Admin → Users → Profile → Application Passwords. Never paste your real login password here.',
        placeholder: 'xxxx xxxx xxxx xxxx xxxx xxxx',
      },
    ],
  },

  // ─── SHOPIFY (OAuth) ────────────────────────────────────────────────────────
  shopify: {
    slug: 'shopify',
    label: 'Shopify',
    category: 'ecommerce',
    authMethod: 'oauth',
    authorizeUrl: 'https://{shop}.myshopify.com/admin/oauth/authorize',
    tokenUrl: 'https://{shop}.myshopify.com/admin/oauth/access_token',
    scopes: ['read_products', 'read_orders', 'read_customers', 'read_analytics'],
    supportsPkce: false,
    clientIdEnv: 'SHOPIFY_CLIENT_ID',
    clientSecretEnv: 'SHOPIFY_CLIENT_SECRET',
    discoverer: 'shopify_store',
    docsUrl: 'https://shopify.dev/docs/api/usage/oauth',
  },

  // ─── STRIPE (OAuth via Stripe Connect) ─────────────────────────────────────
  stripe: {
    slug: 'stripe',
    label: 'Stripe',
    category: 'marketplace',
    authMethod: 'oauth',
    authorizeUrl: 'https://connect.stripe.com/oauth/authorize',
    tokenUrl: 'https://connect.stripe.com/oauth/token',
    scopes: ['read_only'],
    supportsPkce: false,
    clientIdEnv: 'STRIPE_CLIENT_ID',
    clientSecretEnv: 'STRIPE_SECRET_KEY',
    discoverer: 'stripe_account',
    docsUrl: 'https://stripe.com/docs/connect/oauth-reference',
  },

  // ─── HUBSPOT (CRM) ──────────────────────────────────────────────────────────
  hubspot: {
    slug: 'hubspot',
    label: 'HubSpot CRM',
    category: 'crm',
    authMethod: 'oauth',
    authorizeUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    scopes: ['contacts', 'companies', 'deals', 'tickets', 'content'],
    supportsPkce: true,
    clientIdEnv: 'HUBSPOT_CLIENT_ID',
    clientSecretEnv: 'HUBSPOT_CLIENT_SECRET',
    discoverer: 'hubspot_account',
    docsUrl: 'https://developers.hubspot.com/docs/api/oauth-quickstart',
  },

  // ─── MAILCHIMP (manual API key) ────────────────────────────────────────────
  mailchimp: {
    slug: 'mailchimp',
    label: 'Mailchimp',
    category: 'email',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'mailchimp_audiences',
    docsUrl: 'https://mailchimp.com/developer/marketing/api/',
    manualFields: [
      {
        name: 'api_key',
        label: 'Mailchimp API Key',
        secret: true,
        required: true,
        helpText: 'Generate at Account → Extras → API keys. Format: <key>-<dc>, e.g. abc123-us12.',
        placeholder: 'abc123def456-us12',
      },
      {
        name: 'server_prefix',
        label: 'Server Prefix (data center)',
        secret: false,
        required: true,
        helpText: 'The "-us12" suffix of your API key, without the dash.',
        placeholder: 'us12',
      },
    ],
  },

  // ─── SENDGRID (manual API key) ─────────────────────────────────────────────
  sendgrid: {
    slug: 'sendgrid',
    label: 'SendGrid',
    category: 'email',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'sendgrid_sender_identities',
    docsUrl: 'https://docs.sendgrid.com/api-reference',
    manualFields: [
      {
        name: 'api_key',
        label: 'SendGrid API Key',
        secret: true,
        required: true,
        helpText: 'Generate at Settings → API Keys. Use a Restricted key with mail.send + sender_identities.read scopes.',
        placeholder: 'SG.xxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      },
    ],
  },
};

export function getProvider(slug: string): ProviderDefinition | null {
  return PROVIDERS[slug] || null;
}

export function listProviders(): ProviderDefinition[] {
  return Object.values(PROVIDERS);
}

export function listProvidersByCategory(category: ProviderDefinition['category']): ProviderDefinition[] {
  return Object.values(PROVIDERS).filter((p) => p.category === category);
}

/**
 * Resolve the OAuth client_id for a provider from the env vars named in
 * the provider definition. Returns null if the provider has no OAuth
 * client configured — the API route will then return action_required.
 */
export function resolveOAuthClientId(provider: ProviderDefinition): string | null {
  if (!provider.clientIdEnv) return null;
  const val = process.env[provider.clientIdEnv];
  return val && val.length > 0 ? val : null;
}

export function resolveOAuthClientSecret(provider: ProviderDefinition): string | null {
  if (!provider.clientSecretEnv) return null;
  const val = process.env[provider.clientSecretEnv];
  return val && val.length > 0 ? val : null;
}

/**
 * The canonical redirect URI for OAuth callbacks. Always points at the
 * MarketingOS origin (NEXT_PUBLIC_SITE_URL) so the provider's
 * redirect_uri allowlist can be configured once per environment.
 */
export function getCallbackUrl(provider: string): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  return `${origin}/api/v1/integrations/${provider}/callback`;
}
