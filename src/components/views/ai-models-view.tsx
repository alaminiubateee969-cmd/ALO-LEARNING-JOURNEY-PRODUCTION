'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  Play,
  Key,
  Check,
  AlertTriangle,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronRight,
  Boxes,
  ShieldAlert,
  RefreshCw,
  Cpu,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/stores/app-store';

// ============================================================================
// TYPES
// ============================================================================

type ProviderCategory = 'free' | 'self-hosted' | 'hybrid';
type ProviderStatus =
  | 'ok'
  | 'rate_limited'
  | 'auth_failed'
  | 'unconfigured'
  | 'unreachable'
  | null;

interface ModelEntry {
  id: string;
  modelId: string;
  displayName: string;
  contextWindow: number;
  capabilities: string[];
  isDefault: boolean;
  isEnabled: boolean;
  maxOutputTokens: number;
  freeTierNote?: string | null;
}

interface Provider {
  id: string;
  slug: string;
  label: string;
  category: ProviderCategory;
  baseUrl: string | null;
  openAiCompatible: boolean;
  apiKeyOptional: boolean;
  apiKeyEnvName: string | null;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  isEnabled: boolean;
  priority: number;
  lastCheckedAt: string | null;
  lastStatus: ProviderStatus;
  lastError: string | null;
  docsUrl: string | null;
  rateLimitNote: string | null;
  notes: string | null;
  modelCount: number;
  models: ModelEntry[];
  createdAt?: string;
  updatedAt?: string;
}

interface ChainStep {
  provider: string;
  label: string;
  model: string | null;
  modelDisplayName: string | null;
  priority: number;
  api_key_configured: boolean | null;
  last_status: ProviderStatus;
  last_checked_at: string | null;
  will_skip_if_unconfigured: boolean;
}

interface ChainResponse {
  chain: ChainStep[];
  total_steps: number;
  active_llm_steps: number;
  fallback_step: string;
}

interface ProvidersResponse {
  providers: Provider[];
}

interface TestResult {
  status: 'ok' | 'rate_limited' | 'auth_failed' | 'unreachable' | 'unknown';
  latency_ms?: number;
  latencyMs?: number; // alias for safety
  response_preview?: string | null;
  responsePreview?: string | null; // alias for safety
  error?: string | null;
  provider?: string;
  model?: string;
}

// ============================================================================
// API HELPER
// Adds credentials:'include' (sends the mos_token JWT cookie automatically)
// and unwraps the { ok, data } envelope.
// ============================================================================

async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response
    throw new ApiError(`HTTP ${res.status} ${res.statusText}`, res.status);
  }

  if (!res.ok) {
    const body = json as Record<string, unknown> | null;
    const msg =
      (body?.message as string) ||
      (body?.error as string) ||
      `HTTP ${res.status} ${res.statusText}`;
    throw new ApiError(msg, res.status, body);
  }

  const envelope = json as { ok?: boolean; data?: T } | null;
  if (envelope && typeof envelope === 'object' && 'ok' in envelope) {
    return envelope.data as T;
  }
  return json as T;
}

class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const API_BASE = '/api/v1/admin/ai-models';

const CAPABILITY_OPTIONS = [
  'chat',
  'vision',
  'tools',
  'json_mode',
  'embedding',
  'image_generation',
] as const;

interface ProviderPreset {
  name: string;
  slug: string;
  label: string;
  category: ProviderCategory;
  baseUrl?: string;
  openAiCompatible?: boolean;
  apiKeyOptional?: boolean;
  apiKeyEnvName?: string;
  docsUrl?: string;
  rateLimitNote?: string;
  notes?: string;
  priority?: number;
  accent?: string;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: 'Z.AI',
    slug: 'zai',
    label: 'Z.AI',
    category: 'free',
    baseUrl: 'https://api.z.ai/api/v1',
    openAiCompatible: true,
    apiKeyOptional: false,
    apiKeyEnvName: 'ZAI_API_KEY',
    docsUrl: 'https://docs.z.ai',
    rateLimitNote: 'Free tier — generous quota for development',
    priority: 10,
    accent: '#3B82F6',
  },
  {
    name: 'Groq',
    slug: 'groq',
    label: 'Groq',
    category: 'free',
    baseUrl: 'https://api.groq.com/openai/v1',
    openAiCompatible: true,
    apiKeyOptional: false,
    apiKeyEnvName: 'GROQ_API_KEY',
    docsUrl: 'https://console.groq.com/docs',
    rateLimitNote: 'Free tier: 30 req/min, 14,400 req/day',
    priority: 20,
    accent: '#F55036',
  },
  {
    name: 'Gemini',
    slug: 'gemini',
    label: 'Google Gemini',
    category: 'free',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    openAiCompatible: false,
    apiKeyOptional: false,
    apiKeyEnvName: 'GEMINI_API_KEY',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    rateLimitNote: 'Free tier: 15 req/min, 1500 req/day',
    priority: 30,
    accent: '#4285F4',
  },
  {
    name: 'OpenRouter',
    slug: 'openrouter',
    label: 'OpenRouter',
    category: 'free',
    baseUrl: 'https://openrouter.ai/api/v1',
    openAiCompatible: true,
    apiKeyOptional: false,
    apiKeyEnvName: 'OPENROUTER_API_KEY',
    docsUrl: 'https://openrouter.ai/docs',
    rateLimitNote: 'Free tier: 20 req/min, 200 req/day',
    priority: 40,
    accent: '#8B5CF6',
  },
  {
    name: 'Ollama',
    slug: 'ollama',
    label: 'Ollama (Local)',
    category: 'self-hosted',
    baseUrl: 'http://localhost:11434',
    openAiCompatible: false,
    apiKeyOptional: true,
    apiKeyEnvName: 'OLLAMA_API_KEY',
    docsUrl: 'https://ollama.com',
    rateLimitNote: 'No rate limit — bound by local hardware',
    priority: 50,
    accent: '#10B981',
  },
  {
    name: 'OpenCode',
    slug: 'opencode',
    label: 'OpenCode (Local)',
    category: 'self-hosted',
    baseUrl: 'http://localhost:4096/v1',
    openAiCompatible: true,
    apiKeyOptional: true,
    apiKeyEnvName: 'OPENCODE_API_KEY',
    docsUrl: 'https://github.com/sst/opencode',
    rateLimitNote: 'No rate limit — local proxy',
    priority: 60,
    accent: '#F97316',
  },
  {
    name: 'Cloudflare',
    slug: 'cloudflare',
    label: 'Cloudflare Workers AI',
    category: 'free',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai',
    openAiCompatible: false,
    apiKeyOptional: false,
    apiKeyEnvName: 'CLOUDFLARE_API_TOKEN',
    docsUrl: 'https://developers.cloudflare.com/workers-ai/',
    rateLimitNote: 'Free tier: 10,000 neurons/day',
    priority: 70,
    accent: '#F38020',
  },
  {
    name: 'Mistral',
    slug: 'mistral',
    label: 'Mistral AI',
    category: 'free',
    baseUrl: 'https://api.mistral.ai/v1',
    openAiCompatible: true,
    apiKeyOptional: false,
    apiKeyEnvName: 'MISTRAL_API_KEY',
    docsUrl: 'https://docs.mistral.ai',
    rateLimitNote: 'Free tier: 1 req/sec, 500,000 tokens/month',
    priority: 80,
    accent: '#FFA500',
  },
  {
    name: 'Hugging Face',
    slug: 'huggingface',
    label: 'Hugging Face',
    category: 'free',
    baseUrl: 'https://api-inference.huggingface.co/models',
    openAiCompatible: false,
    apiKeyOptional: false,
    apiKeyEnvName: 'HF_API_TOKEN',
    docsUrl: 'https://huggingface.co/docs/api-inference',
    rateLimitNote: 'Free tier: 1000 req/day with rate limiting',
    priority: 90,
    accent: '#FFD21E',
  },
  {
    name: 'Pollinations',
    slug: 'pollinations',
    label: 'Pollinations (Image)',
    category: 'free',
    baseUrl: 'https://image.pollinations.ai',
    openAiCompatible: false,
    apiKeyOptional: true,
    docsUrl: 'https://pollinations.ai',
    rateLimitNote: 'No rate limit, no key — public free endpoint',
    priority: 100,
    accent: '#EC4899',
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  try {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    if (diff < 0) return 'just now';
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return date.toLocaleDateString();
  } catch {
    return iso;
  }
}

function statusBadgeClass(status: ProviderStatus): string {
  switch (status) {
    case 'ok':
      return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400';
    case 'rate_limited':
      return 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400';
    case 'auth_failed':
      return 'bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400';
    case 'unreachable':
      return 'bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400';
    case 'unconfigured':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20 dark:text-gray-400';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20 dark:text-gray-400';
  }
}

function statusLabel(status: ProviderStatus): string {
  switch (status) {
    case 'ok':
      return 'OK';
    case 'rate_limited':
      return 'Rate Limited';
    case 'auth_failed':
      return 'Auth Failed';
    case 'unconfigured':
      return 'Unconfigured';
    case 'unreachable':
      return 'Unreachable';
    default:
      return 'Unknown';
  }
}

function statusDot(status: ProviderStatus): string {
  switch (status) {
    case 'ok':
      return 'bg-emerald-500';
    case 'rate_limited':
      return 'bg-amber-500';
    case 'auth_failed':
      return 'bg-red-500';
    case 'unreachable':
      return 'bg-red-500';
    case 'unconfigured':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
}

function categoryBadgeClass(cat: ProviderCategory): string {
  switch (cat) {
    case 'free':
      return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400';
    case 'self-hosted':
      return 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400';
    case 'hybrid':
      return 'bg-purple-500/15 text-purple-600 border-purple-500/30 dark:text-purple-400';
  }
}

function categoryLabel(cat: ProviderCategory): string {
  switch (cat) {
    case 'free':
      return 'Free';
    case 'self-hosted':
      return 'Self-hosted';
    case 'hybrid':
      return 'Hybrid';
  }
}

// ============================================================================
// FORBIDDEN SCREEN
// ============================================================================

function ForbiddenScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-xl font-semibold">Forbidden</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        Only <span className="font-medium text-foreground">Super Admins</span> can access the AI
        Model Registry. Your current role does not have permission to view this page.
      </p>
    </div>
  );
}

// ============================================================================
// ERROR BANNER
// ============================================================================

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-red-500/30 bg-red-500/[0.04]">
      <CardContent className="p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Failed to load AI model registry
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{message}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onRetry} className="shrink-0">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-10 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-base font-semibold">No AI providers yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Add your first free AI provider — Z.AI, Groq, Gemini, OpenRouter, Ollama, OpenCode,
          Cloudflare, Mistral, Hugging Face, or Pollinations. No paid APIs.
        </p>
        <Button className="mt-4" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add your first provider
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CHAIN PREVIEW
// ============================================================================

function ChainPill({ step, isLast }: { step: ChainStep; isLast: boolean }) {
  const isFallback = step.provider === 'rule-based';
  const status: ProviderStatus = isFallback
    ? 'ok'
    : step.api_key_configured === false && step.will_skip_if_unconfigured
      ? 'unconfigured'
      : step.last_status;

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div
        className={`flex flex-col gap-1 rounded-lg border px-3 py-2 min-w-[180px] max-w-[260px] ${
          isFallback
            ? 'border-purple-500/30 bg-purple-500/[0.06]'
            : status === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
              : status === 'unconfigured'
                ? 'border-gray-500/20 bg-gray-500/[0.04]'
                : 'border-amber-500/30 bg-amber-500/[0.04]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono font-medium truncate">
            {step.provider}
          </span>
          <span className={`w-2 h-2 rounded-full ${statusDot(status)} shrink-0`} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground truncate">
            {step.modelDisplayName || step.model || '—'}
          </span>
          <Badge
            variant="outline"
            className={`text-[9px] px-1.5 h-3.5 ${statusBadgeClass(status)} shrink-0`}
          >
            {statusLabel(status)}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="font-mono">P{step.priority}</span>
          <span>{step.last_checked_at ? formatRelative(step.last_checked_at) : 'untested'}</span>
        </div>
      </div>
      {!isLast && (
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
      )}
    </div>
  );
}

function ChainPreview({
  chain,
  loading,
}: {
  chain: ChainStep[] | null;
  loading: boolean;
}) {
  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">Live Chain Preview</CardTitle>
          </div>
          {chain && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {chain.length} steps
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
              >
                {chain.filter((s) => s.provider !== 'rule-based' && s.api_key_configured).length}{' '}
                active
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading && !chain ? (
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <React.Fragment key={i}>
                <Skeleton className="h-[68px] w-[200px] rounded-lg" />
                {i < 3 && <Skeleton className="w-4 h-4 rounded" />}
              </React.Fragment>
            ))}
          </div>
        ) : chain && chain.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {chain.map((step, i) => (
              <ChainPill key={`${step.provider}-${i}`} step={step} isLast={i === chain.length - 1} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chain unavailable.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// PROVIDER CARD
// ============================================================================

function ProviderCard({
  provider,
  onTest,
  onEdit,
  onAddModel,
  onDelete,
  onToggleEnabled,
  onEditModel,
  onDeleteModel,
  testing,
}: {
  provider: Provider;
  onTest: () => void;
  onEdit: () => void;
  onAddModel: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onEditModel: (model: ModelEntry) => void;
  onDeleteModel: (model: ModelEntry) => void;
  testing: boolean;
}) {
  const [modelsOpen, setModelsOpen] = useState(false);

  const apiKeyStatusEl = provider.apiKeyOptional ? (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="text-gray-400">—</span> Not required
    </span>
  ) : provider.apiKeyConfigured ? (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <Check className="w-3 h-3" /> Configured
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
      <AlertTriangle className="w-3 h-3" /> Not set
    </span>
  );

  return (
    <Card className={provider.isEnabled ? '' : 'opacity-70'}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-chart-2/20 border border-border flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold truncate">{provider.label}</h3>
                <Badge
                  variant="outline"
                  className={`text-[10px] h-5 ${categoryBadgeClass(provider.category)}`}
                >
                  {categoryLabel(provider.category)}
                </Badge>
                {provider.isEnabled ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  >
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] h-5 opacity-60">
                    Disabled
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <code className="text-[11px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                  {provider.slug}
                </code>
                <span className="text-[11px] text-muted-foreground">
                  Priority {provider.priority}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor={`toggle-${provider.id}`} className="text-[10px] text-muted-foreground">
              {provider.isEnabled ? 'On' : 'Off'}
            </Label>
            <Switch
              id={`toggle-${provider.id}`}
              checked={provider.isEnabled}
              onCheckedChange={onToggleEnabled}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Base URL */}
        {provider.baseUrl && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-20 shrink-0">Base URL</span>
            <code className="text-[11px] font-mono text-foreground/80 bg-muted/40 px-1.5 py-0.5 rounded truncate flex-1">
              {provider.baseUrl}
            </code>
          </div>
        )}

        {/* API key status + masked */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground w-20 shrink-0">API Key</span>
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            {apiKeyStatusEl}
            {provider.apiKeyConfigured && provider.apiKeyMasked && (
              <code className="text-[11px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                {provider.apiKeyMasked}
              </code>
            )}
            {provider.apiKeyEnvName && (
              <span className="text-[10px] text-muted-foreground">
                env:{provider.apiKeyEnvName}
              </span>
            )}
          </div>
        </div>

        {/* Docs + rate limit */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground w-20 shrink-0">Rate limit</span>
          <span className="text-[11px] text-foreground/80 truncate">
            {provider.rateLimitNote || '—'}
          </span>
        </div>

        {/* Health check */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground w-20 shrink-0">Health</span>
          <div className="flex items-center gap-2 flex-wrap">
            {provider.lastStatus && (
              <Badge
                variant="outline"
                className={`text-[10px] h-5 ${statusBadgeClass(provider.lastStatus)}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot(provider.lastStatus)} mr-1`} />
                {statusLabel(provider.lastStatus)}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">
              checked {formatRelative(provider.lastCheckedAt)}
            </span>
            {provider.lastError && (
              <span className="text-[11px] text-red-600 dark:text-red-400 truncate max-w-[260px]">
                {provider.lastError}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 pt-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={onTest}
            disabled={testing}
            className="h-8"
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1" />
            )}
            Test
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit} className="h-8">
            <Pencil className="w-3.5 h-3.5 mr-1" />
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={onAddModel} className="h-8">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Model
          </Button>
          {provider.docsUrl && (
            <Button size="sm" variant="ghost" asChild className="h-8">
              <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Docs
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Models section */}
        <Collapsible open={modelsOpen} onOpenChange={setModelsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full h-8 justify-between text-xs">
              <span className="flex items-center gap-2">
                {modelsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                Models
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {provider.models.length}
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-lg border border-border/50 overflow-hidden">
              {provider.models.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No models configured. Click &ldquo;Add Model&rdquo; to add one.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-[11px] h-8">Model ID</TableHead>
                      <TableHead className="text-[11px] h-8">Capabilities</TableHead>
                      <TableHead className="text-[11px] h-8 text-right">Context</TableHead>
                      <TableHead className="text-[11px] h-8 text-right">Max Out</TableHead>
                      <TableHead className="text-[11px] h-8 text-center">Default</TableHead>
                      <TableHead className="text-[11px] h-8 text-center">Enabled</TableHead>
                      <TableHead className="text-[11px] h-8 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {provider.models.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium">{m.displayName}</span>
                            <code className="text-[10px] font-mono text-muted-foreground">
                              {m.modelId}
                            </code>
                            {m.freeTierNote && (
                              <span className="text-[10px] text-muted-foreground italic">
                                {m.freeTierNote}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {m.capabilities.length === 0 ? (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            ) : (
                              m.capabilities.map((c) => (
                                <Badge
                                  key={c}
                                  variant="outline"
                                  className="text-[9px] px-1.5 h-4 bg-primary/5"
                                >
                                  {c}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs font-mono">
                          {m.contextWindow.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs font-mono">
                          {m.maxOutputTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          {m.isDefault && (
                            <Check className="w-3.5 h-3.5 text-emerald-500 inline" />
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              m.isEnabled ? 'bg-emerald-500' : 'bg-gray-400'
                            }`}
                          />
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => onEditModel(m)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => onDeleteModel(m)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// PROVIDER DIALOG (ADD / EDIT)
// ============================================================================

interface ProviderFormState {
  slug: string;
  label: string;
  category: ProviderCategory;
  baseUrl: string;
  openAiCompatible: boolean;
  apiKeyOptional: boolean;
  apiKeyEnvName: string;
  apiKey: string;
  docsUrl: string;
  rateLimitNote: string;
  priority: number;
  notes: string;
  isEnabled: boolean;
}

const emptyProviderForm: ProviderFormState = {
  slug: '',
  label: '',
  category: 'free',
  baseUrl: '',
  openAiCompatible: true,
  apiKeyOptional: false,
  apiKeyEnvName: '',
  apiKey: '',
  docsUrl: '',
  rateLimitNote: '',
  priority: 100,
  notes: '',
  isEnabled: true,
};

function ProviderDialog({
  open,
  mode,
  provider,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'add' | 'edit';
  provider: Provider | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ProviderFormState>(emptyProviderForm);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSlugTouched(false);
    if (mode === 'edit' && provider) {
      setForm({
        slug: provider.slug,
        label: provider.label,
        category: provider.category,
        baseUrl: provider.baseUrl || '',
        openAiCompatible: provider.openAiCompatible,
        apiKeyOptional: provider.apiKeyOptional,
        apiKeyEnvName: provider.apiKeyEnvName || '',
        apiKey: '',
        docsUrl: provider.docsUrl || '',
        rateLimitNote: provider.rateLimitNote || '',
        priority: provider.priority,
        notes: provider.notes || '',
        isEnabled: provider.isEnabled,
      });
    } else {
      setForm(emptyProviderForm);
    }
  }, [open, mode, provider]);

  // Auto-generate slug from label when adding
  useEffect(() => {
    if (mode !== 'add' || slugTouched) return;
    setForm((prev) => ({ ...prev, slug: slugify(prev.label) }));
  }, [form.label, mode, slugTouched]);

  const applyPreset = (preset: ProviderPreset) => {
    setSlugTouched(true);
    setForm((prev) => ({
      ...prev,
      slug: preset.slug,
      label: preset.label,
      category: preset.category,
      baseUrl: preset.baseUrl || '',
      openAiCompatible: preset.openAiCompatible ?? true,
      apiKeyOptional: preset.apiKeyOptional ?? false,
      apiKeyEnvName: preset.apiKeyEnvName || '',
      docsUrl: preset.docsUrl || '',
      rateLimitNote: preset.rateLimitNote || '',
      notes: preset.notes || '',
      priority: preset.priority ?? 100,
    }));
  };

  const handleSave = async () => {
    if (!form.label.trim()) {
      toast({ title: 'Label is required', variant: 'destructive' });
      return;
    }
    if (!form.slug.trim()) {
      toast({ title: 'Slug is required', variant: 'destructive' });
      return;
    }
    if (mode === 'add' && !/^[a-z0-9-]+$/.test(form.slug)) {
      toast({
        title: 'Invalid slug',
        description: 'Use lowercase kebab-case (letters, numbers, hyphens only).',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        label: form.label.trim(),
        category: form.category,
        baseUrl: form.baseUrl.trim() || null,
        openAiCompatible: form.openAiCompatible,
        apiKeyOptional: form.apiKeyOptional,
        apiKeyEnvName: form.apiKeyEnvName.trim() || null,
        docsUrl: form.docsUrl.trim() || null,
        rateLimitNote: form.rateLimitNote.trim() || null,
        notes: form.notes.trim() || null,
        priority: Number(form.priority) || 100,
        isEnabled: form.isEnabled,
      };
      if (form.apiKey.trim()) {
        body.api_key = form.apiKey.trim();
      }

      if (mode === 'add') {
        body.slug = form.slug.trim();
        await apiFetch(`${API_BASE}/providers`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast({
          title: 'Provider created',
          description: `${form.label} has been added to the registry.`,
        });
      } else if (provider) {
        await apiFetch(`${API_BASE}/providers/${provider.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast({
          title: 'Provider updated',
          description: `${form.label} has been updated.`,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      const e = err as ApiError;
      toast({
        title: `Failed to ${mode === 'add' ? 'create' : 'update'} provider`,
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'add' ? (
              <>
                <Plus className="w-5 h-5 text-primary" /> Add Provider
              </>
            ) : (
              <>
                <Pencil className="w-5 h-5 text-primary" /> Edit Provider
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Register a new free or self-hosted AI provider. No paid APIs.'
              : `Editing ${provider?.label}. Slug is read-only.`}
          </DialogDescription>
        </DialogHeader>

        {/* Quick Add presets */}
        {mode === 'add' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Add presets</Label>
            <div className="flex flex-wrap gap-1.5">
              {PROVIDER_PRESETS.map((preset) => (
                <Button
                  key={preset.slug}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyPreset(preset)}
                >
                  <span
                    className="w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: preset.accent || '#888' }}
                  />
                  {preset.name}
                </Button>
              ))}
            </div>
            <Separator />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="prov-label">Label *</Label>
            <Input
              id="prov-label"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Z.AI (GLM-4.6)"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prov-slug">Slug *</Label>
            <Input
              id="prov-slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm({ ...form, slug: e.target.value });
              }}
              placeholder="e.g. zai"
              className="font-mono"
              disabled={mode === 'edit'}
            />
            <p className="text-[10px] text-muted-foreground">
              {mode === 'edit'
                ? 'Slug is read-only (used as unique key).'
                : 'Lowercase kebab-case. Auto-generated from label.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prov-category">Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v as ProviderCategory })}
            >
              <SelectTrigger id="prov-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="self-hosted">Self-hosted</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="prov-baseurl">Base URL</Label>
            <Input
              id="prov-baseurl"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1 — leave blank for env-var-only"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prov-priority">Priority</Label>
            <Input
              id="prov-priority"
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              placeholder="100"
            />
            <p className="text-[10px] text-muted-foreground">Lower = earlier in chain.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prov-docs">Docs URL</Label>
            <Input
              id="prov-docs"
              value={form.docsUrl}
              onChange={(e) => setForm({ ...form, docsUrl: e.target.value })}
              placeholder="https://docs.example.com"
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="prov-env">API key env name</Label>
            <Input
              id="prov-env"
              value={form.apiKeyEnvName}
              onChange={(e) => setForm({ ...form, apiKeyEnvName: e.target.value })}
              placeholder="e.g. GROQ_API_KEY"
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              If set, the chain will fall back to this env var when no key is stored.
            </p>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="prov-key">
              <Key className="w-3.5 h-3.5 mr-1 inline" />
              API key
            </Label>
            <Input
              id="prov-key"
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={
                mode === 'edit' && provider?.apiKeyMasked
                  ? `Stored: ${provider.apiKeyMasked} — enter new key to rotate`
                  : 'Paste API key (stored encrypted)'
              }
              className="font-mono text-xs"
              autoComplete="off"
            />
            <p className="text-[10px] text-muted-foreground">
              Stored encrypted in the vault. Never returned in plain text.
            </p>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="prov-ratelimit">Rate limit note</Label>
            <Input
              id="prov-ratelimit"
              value={form.rateLimitNote}
              onChange={(e) => setForm({ ...form, rateLimitNote: e.target.value })}
              placeholder="e.g. Free tier: 30 req/min, 14,400 req/day"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="prov-notes">Notes</Label>
            <Textarea
              id="prov-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Internal notes for this provider…"
              rows={2}
            />
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="prov-openai"
                checked={form.openAiCompatible}
                onCheckedChange={(v) => setForm({ ...form, openAiCompatible: !!v })}
              />
              <Label htmlFor="prov-openai" className="text-xs cursor-pointer">
                OpenAI-compatible
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="prov-keyopt"
                checked={form.apiKeyOptional}
                onCheckedChange={(v) => setForm({ ...form, apiKeyOptional: !!v })}
              />
              <Label htmlFor="prov-keyopt" className="text-xs cursor-pointer">
                API key optional
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="prov-enabled"
                checked={form.isEnabled}
                onCheckedChange={(v) => setForm({ ...form, isEnabled: v })}
              />
              <Label htmlFor="prov-enabled" className="text-xs cursor-pointer">
                Enabled
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1.5" />
            )}
            {mode === 'add' ? 'Create Provider' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MODEL DIALOG (ADD / EDIT)
// ============================================================================

interface ModelFormState {
  modelId: string;
  displayName: string;
  contextWindow: number;
  capabilities: string[];
  maxOutputTokens: number;
  isDefault: boolean;
  isEnabled: boolean;
  freeTierNote: string;
}

const emptyModelForm: ModelFormState = {
  modelId: '',
  displayName: '',
  contextWindow: 8192,
  capabilities: ['chat'],
  maxOutputTokens: 4096,
  isDefault: false,
  isEnabled: true,
  freeTierNote: '',
};

function ModelDialog({
  open,
  mode,
  provider,
  model,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'add' | 'edit';
  provider: Provider | null;
  model: ModelEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ModelFormState>(emptyModelForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && model) {
      setForm({
        modelId: model.modelId,
        displayName: model.displayName,
        contextWindow: model.contextWindow,
        capabilities: model.capabilities.length ? [...model.capabilities] : ['chat'],
        maxOutputTokens: model.maxOutputTokens,
        isDefault: model.isDefault,
        isEnabled: model.isEnabled,
        freeTierNote: model.freeTierNote || '',
      });
    } else {
      setForm(emptyModelForm);
    }
  }, [open, mode, model]);

  const toggleCapability = (cap: string) => {
    setForm((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter((c) => c !== cap)
        : [...prev.capabilities, cap],
    }));
  };

  const handleSave = async () => {
    if (!provider) return;
    if (!form.modelId.trim() || !form.displayName.trim()) {
      toast({
        title: 'Required fields missing',
        description: 'Model ID and Display name are required.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        displayName: form.displayName.trim(),
        contextWindow: Number(form.contextWindow) || 8192,
        capabilities: form.capabilities,
        maxOutputTokens: Number(form.maxOutputTokens) || 4096,
        isDefault: form.isDefault,
        isEnabled: form.isEnabled,
        freeTierNote: form.freeTierNote.trim() || null,
      };

      if (mode === 'add') {
        body.modelId = form.modelId.trim();
        await apiFetch(`${API_BASE}/providers/${provider.id}/models`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast({
          title: 'Model added',
          description: `${form.displayName} added to ${provider.label}.`,
        });
      } else if (model) {
        await apiFetch(
          `${API_BASE}/providers/${provider.id}/models/${encodeURIComponent(model.modelId)}`,
          { method: 'PATCH', body: JSON.stringify(body) }
        );
        toast({
          title: 'Model updated',
          description: `${form.displayName} has been updated.`,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      const e = err as ApiError;
      toast({
        title: `Failed to ${mode === 'add' ? 'add' : 'update'} model`,
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'add' ? (
              <>
                <Plus className="w-5 h-5 text-primary" /> Add Model to {provider?.label}
              </>
            ) : (
              <>
                <Pencil className="w-5 h-5 text-primary" /> Edit Model
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Register a new model entry for this provider.'
              : `Editing ${model?.displayName}. Model ID is read-only.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="model-id">Model ID *</Label>
            <Input
              id="model-id"
              value={form.modelId}
              onChange={(e) => setForm({ ...form, modelId: e.target.value })}
              placeholder="e.g. llama-3.3-70b-versatile"
              className="font-mono text-xs"
              disabled={mode === 'edit'}
            />
            <p className="text-[10px] text-muted-foreground">
              The exact model identifier used in API requests.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="model-name">Display name *</Label>
            <Input
              id="model-name"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="e.g. Llama 3.3 70B Versatile"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="model-ctx">Context window</Label>
              <Input
                id="model-ctx"
                type="number"
                value={form.contextWindow}
                onChange={(e) => setForm({ ...form, contextWindow: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model-maxout">Max output tokens</Label>
              <Input
                id="model-maxout"
                type="number"
                value={form.maxOutputTokens}
                onChange={(e) => setForm({ ...form, maxOutputTokens: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Capabilities</Label>
            <div className="flex flex-wrap gap-1.5">
              {CAPABILITY_OPTIONS.map((cap) => {
                const active = form.capabilities.includes(cap);
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => toggleCapability(cap)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      active
                        ? 'bg-primary/15 text-primary border-primary/40'
                        : 'bg-transparent text-muted-foreground border-border hover:bg-accent'
                    }`}
                  >
                    {cap}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="model-freenote">Free tier note</Label>
            <Input
              id="model-freenote"
              value={form.freeTierNote}
              onChange={(e) => setForm({ ...form, freeTierNote: e.target.value })}
              placeholder="e.g. Fastest free tier"
            />
          </div>

          <div className="flex items-center gap-4 pt-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="model-default"
                checked={form.isDefault}
                onCheckedChange={(v) => setForm({ ...form, isDefault: !!v })}
              />
              <Label htmlFor="model-default" className="text-xs cursor-pointer">
                Default model
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="model-enabled"
                checked={form.isEnabled}
                onCheckedChange={(v) => setForm({ ...form, isEnabled: v })}
              />
              <Label htmlFor="model-enabled" className="text-xs cursor-pointer">
                Enabled
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1.5" />
            )}
            {mode === 'add' ? 'Add Model' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DELETE CONFIRMATION DIALOG
// ============================================================================

function DeleteConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={busy}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={busy}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// MAIN VIEW
// ============================================================================

export function AiModelsView() {
  const { user } = useAppStore();
  const { toast } = useToast();

  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [chain, setChain] = useState<ChainStep[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [chainLoading, setChainLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [providerDialog, setProviderDialog] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    provider: Provider | null;
  }>({ open: false, mode: 'add', provider: null });

  const [modelDialog, setModelDialog] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    provider: Provider | null;
    model: ModelEntry | null;
  }>({ open: false, mode: 'add', provider: null, model: null });

  const [deleteProvider, setDeleteProvider] = useState<Provider | null>(null);
  const [deleteModelTarget, setDeleteModelTarget] = useState<{
    provider: Provider;
    model: ModelEntry;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [testingId, setTestingId] = useState<string | null>(null);

  const isSuperAdmin = user?.role === 'super_admin';

  const fetchProviders = useCallback(async () => {
    setError(null);
    setForbidden(false);
    setLoading(true);
    try {
      const data = await apiFetch<ProvidersResponse>(`${API_BASE}/providers`);
      setProviders(data?.providers || []);
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 403) setForbidden(true);
      setError(e.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChain = useCallback(async () => {
    setChainLoading(true);
    try {
      const data = await apiFetch<ChainResponse>(`${API_BASE}/chain`);
      setChain(data?.chain || []);
    } catch {
      // Chain is informational — silent on failure
      setChain(null);
    } finally {
      setChainLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchProviders();
    fetchChain();
  }, [isSuperAdmin, fetchProviders, fetchChain]);

  const refreshAll = useCallback(() => {
    fetchProviders();
    fetchChain();
  }, [fetchProviders, fetchChain]);

  // ---- Actions ----

  const handleToggleEnabled = async (provider: Provider, enabled: boolean) => {
    // Optimistic update
    setProviders((prev) =>
      prev
        ? prev.map((p) => (p.id === provider.id ? { ...p, isEnabled: enabled } : p))
        : prev
    );
    try {
      await apiFetch(`${API_BASE}/providers/${provider.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: enabled }),
      });
      toast({
        title: enabled ? 'Provider enabled' : 'Provider disabled',
        description: `${provider.label} is now ${enabled ? 'active' : 'inactive'} in the chain.`,
      });
      fetchChain();
    } catch (err) {
      // Revert on failure
      setProviders((prev) =>
        prev
          ? prev.map((p) => (p.id === provider.id ? { ...p, isEnabled: !enabled } : p))
          : prev
      );
      const e = err as ApiError;
      toast({
        title: 'Failed to toggle provider',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const handleTest = async (provider: Provider) => {
    setTestingId(provider.id);
    const start = Date.now();
    try {
      const result = await apiFetch<TestResult>(
        `${API_BASE}/providers/${provider.id}/test`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      const latency = result?.latency_ms ?? result?.latencyMs ?? Date.now() - start;
      const status = result?.status || 'ok';
      const previewRaw = result?.response_preview ?? result?.responsePreview ?? '';
      const preview = String(previewRaw || '').slice(0, 200);
      const errMsg = result?.error;

      const variant: 'default' | 'destructive' =
        status === 'ok' ? 'default' : 'destructive';
      const title =
        status === 'ok'
          ? `${provider.label}: healthy`
          : `${provider.label}: ${statusLabel(status)}`;

      toast({
        title,
        description: (
          <div className="space-y-0.5 text-xs">
            <div>Status: <span className="font-mono">{status}</span> · Latency: <span className="font-mono">{latency}ms</span></div>
            {preview && <div className="font-mono text-[10px] opacity-80 break-all">Preview: {preview}</div>}
            {errMsg && <div className="text-red-300">Error: {errMsg}</div>}
          </div>
        ),
        variant,
      });
      // Refresh provider + chain to reflect new lastStatus
      fetchProviders();
      fetchChain();
    } catch (err) {
      const e = err as ApiError;
      const latency = Date.now() - start;
      toast({
        title: `${provider.label}: test failed`,
        description: (
          <div className="space-y-0.5 text-xs">
            <div>Status: <span className="font-mono">unreachable</span> · Latency: <span className="font-mono">{latency}ms</span></div>
            <div className="text-red-300">Error: {e.message}</div>
          </div>
        ),
        variant: 'destructive',
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteProvider = async () => {
    if (!deleteProvider) return;
    setDeleting(true);
    try {
      await apiFetch(`${API_BASE}/providers/${deleteProvider.id}`, {
        method: 'DELETE',
      });
      toast({
        title: 'Provider deleted',
        description: `${deleteProvider.label} and all its models were removed.`,
      });
      setDeleteProvider(null);
      refreshAll();
    } catch (err) {
      const e = err as ApiError;
      toast({
        title: 'Failed to delete provider',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteModel = async () => {
    if (!deleteModelTarget) return;
    const { provider, model } = deleteModelTarget;
    setDeleting(true);
    try {
      await apiFetch(
        `${API_BASE}/providers/${provider.id}/models/${encodeURIComponent(model.modelId)}`,
        { method: 'DELETE' }
      );
      toast({
        title: 'Model deleted',
        description: `${model.displayName} was removed from ${provider.label}.`,
      });
      setDeleteModelTarget(null);
      refreshAll();
    } catch (err) {
      const e = err as ApiError;
      toast({
        title: 'Failed to delete model',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // ---- Render ----

  if (!isSuperAdmin) {
    return <ForbiddenScreen />;
  }

  // If the API explicitly returned 403, show forbidden screen
  if (forbidden) {
    return <ForbiddenScreen />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">AI Model Registry</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Manage free AI providers and models that power your AI workforce. Add OpenCode, Ollama,
            OpenRouter, Groq, Gemini, Z.AI — all free or self-hosted. No paid APIs.
          </p>
        </div>
        <Button
          onClick={() =>
            setProviderDialog({ open: true, mode: 'add', provider: null })
          }
          className="shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Provider
        </Button>
      </div>

      {/* Chain Preview */}
      <ChainPreview chain={chain} loading={chainLoading} />

      {/* Error banner */}
      {error && !forbidden && <ErrorBanner message={error} onRetry={refreshAll} />}

      {/* Provider grid */}
      {loading && !providers ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="w-8 h-4 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : providers && providers.length === 0 && !error ? (
        <EmptyState
          onAdd={() =>
            setProviderDialog({ open: true, mode: 'add', provider: null })
          }
        />
      ) : providers && providers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onTest={() => handleTest(provider)}
              onEdit={() =>
                setProviderDialog({ open: true, mode: 'edit', provider })
              }
              onAddModel={() =>
                setModelDialog({
                  open: true,
                  mode: 'add',
                  provider,
                  model: null,
                })
              }
              onDelete={() => setDeleteProvider(provider)}
              onToggleEnabled={(enabled) => handleToggleEnabled(provider, enabled)}
              onEditModel={(model) =>
                setModelDialog({ open: true, mode: 'edit', provider, model })
              }
              onDeleteModel={(model) =>
                setDeleteModelTarget({ provider, model })
              }
              testing={testingId === provider.id}
            />
          ))}
        </div>
      ) : null}

      {/* Provider Dialog */}
      <ProviderDialog
        open={providerDialog.open}
        mode={providerDialog.mode}
        provider={providerDialog.provider}
        onClose={() =>
          setProviderDialog({ open: false, mode: 'add', provider: null })
        }
        onSaved={refreshAll}
      />

      {/* Model Dialog */}
      <ModelDialog
        open={modelDialog.open}
        mode={modelDialog.mode}
        provider={modelDialog.provider}
        model={modelDialog.model}
        onClose={() =>
          setModelDialog({ open: false, mode: 'add', provider: null, model: null })
        }
        onSaved={refreshAll}
      />

      {/* Delete Provider Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteProvider}
        title={`Delete ${deleteProvider?.label}?`}
        description={
          deleteProvider
            ? `This will permanently remove ${deleteProvider.label} and all ${deleteProvider.models.length} model(s). This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Provider"
        onConfirm={handleDeleteProvider}
        onCancel={() => setDeleteProvider(null)}
        busy={deleting}
      />

      {/* Delete Model Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteModelTarget}
        title={`Delete ${deleteModelTarget?.model.displayName}?`}
        description={
          deleteModelTarget
            ? `This will permanently remove ${deleteModelTarget.model.displayName} (${deleteModelTarget.model.modelId}) from ${deleteModelTarget.provider.label}. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Model"
        onConfirm={handleDeleteModel}
        onCancel={() => setDeleteModelTarget(null)}
        busy={deleting}
      />
    </div>
  );
}

export default AiModelsView;
