/**
 * Platform definitions for the dashboard.
 *
 * Lists all social/marketing/integration platforms supported by MarketingOS.
 * Used by the dashboard view to show platform counts + connection status.
 */

export interface Platform {
  id: string;
  name: string;
  icon: string;
  category: 'social' | 'analytics' | 'crm' | 'email' | 'ecommerce';
  connected: boolean;
}

export const PLATFORMS: Platform[] = [
  { id: 'facebook', name: 'Facebook', icon: 'facebook', category: 'social', connected: false },
  { id: 'instagram', name: 'Instagram', icon: 'instagram', category: 'social', connected: false },
  { id: 'linkedin', name: 'LinkedIn', icon: 'linkedin', category: 'social', connected: false },
  { id: 'twitter', name: 'X (Twitter)', icon: 'twitter', category: 'social', connected: false },
  { id: 'tiktok', name: 'TikTok', icon: 'tiktok', category: 'social', connected: false },
  { id: 'youtube', name: 'YouTube', icon: 'youtube', category: 'social', connected: false },
  { id: 'pinterest', name: 'Pinterest', icon: 'pinterest', category: 'social', connected: false },
  { id: 'google_analytics', name: 'Google Analytics', icon: 'chart', category: 'analytics', connected: false },
  { id: 'google_search_console', name: 'Search Console', icon: 'search', category: 'analytics', connected: false },
  { id: 'hubspot', name: 'HubSpot CRM', icon: 'crm', category: 'crm', connected: false },
  { id: 'mailchimp', name: 'Mailchimp', icon: 'mail', category: 'email', connected: false },
  { id: 'sendgrid', name: 'SendGrid', icon: 'mail', category: 'email', connected: false },
  { id: 'shopify', name: 'Shopify', icon: 'shop', category: 'ecommerce', connected: false },
  { id: 'stripe', name: 'Stripe', icon: 'card', category: 'ecommerce', connected: false },
];

export function getConnectedPlatforms(): Platform[] {
  return PLATFORMS.filter(p => p.connected);
}

export function getPlatformCount(): number {
  return PLATFORMS.length;
}

export function PlatformBadge({ platform }: { platform: string }) {
  return null; // placeholder — dashboard renders its own badges
}

