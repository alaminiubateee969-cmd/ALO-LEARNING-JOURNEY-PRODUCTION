"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, Copy, Eye, EyeOff, KeyRound, PlusCircle, RefreshCw, ShieldAlert } from "lucide-react";
import {
  BUILTIN_PROVIDER_DEFAULTS,
  buildProviderEnvSnippet,
  type ProviderFormKind,
} from "@/lib/ai-provider-config";

interface ProviderStatus {
  provider: string;
  kind: "free-tier" | "owner-gateway";
  configured: boolean;
  model: string;
  reason: string;
}

interface ExternalStatus {
  enabled: boolean;
  configured: boolean;
  order: string[];
  providers: ProviderStatus[];
  dataPolicy: string;
}

const OMNIROUTE_DOCKER = `docker run -d --name omniroute --restart unless-stopped \\
  -p 127.0.0.1:20128:20128 diegosouzapw/omniroute:latest
# Then open http://127.0.0.1:20128, create an API key, and use it below.
# (Pin a version/digest instead of :latest for production use.)`;

const REASON_LABEL: Record<string, string> = {
  ready: "Ready",
  disabled: "Disabled (owner switches off)",
  missing_api_key: "Missing API key",
  invalid_model: "Invalid model",
  non_free_model: "Non-free model blocked",
  invalid_endpoint: "Invalid endpoint",
};

export default function AiProvidersSettings() {
  const { toast } = useToast();
  const [external, setExternal] = useState<ExternalStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [kind, setKind] = useState<ProviderFormKind>("omniroute");
  const [customId, setCustomId] = useState("");
  const [customName, setCustomName] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:20128/v1");
  const [model, setModel] = useState("auto");
  const [apiKeyEnv, setApiKeyEnv] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [putFirst, setPutFirst] = useState(false);

  const requestStatus = () =>
    fetch("/api/ai/local-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setExternal(d.external ?? null);
        setStatusError(d.external ? null : "External provider status was not returned.");
      })
      .catch((e) => setStatusError(e instanceof Error ? e.message : "Could not load provider status"));

  useEffect(() => { void requestStatus(); }, []);

  const refreshStatus = () => {
    setRefreshing(true);
    void requestStatus().finally(() => setRefreshing(false));
  };

  const pickKind = (value: ProviderFormKind) => {
    setKind(value);
    if (value === "omniroute") { setBaseUrl("http://127.0.0.1:20128/v1"); setModel("auto"); }
    else if (value === "custom") { setBaseUrl("https://llm.example.com/v1"); setModel(""); }
    else setModel(BUILTIN_PROVIDER_DEFAULTS[value].defaultModel);
  };

  const result = useMemo(
    () => buildProviderEnvSnippet({ kind, id: customId, name: customName, baseUrl, model, apiKeyEnv, apiKeyValue, putFirst }),
    [kind, customId, customName, baseUrl, model, apiKeyEnv, apiKeyValue, putFirst]
  );

  const copyText = async (text: string, title: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title, description: "Paste it into the server .env, then restart the app (PM2)." });
    } catch {
      toast({ title: "Copy failed", description: "Select the text and copy it manually.", variant: "destructive" });
    }
  };

  const isGateway = kind === "omniroute" || kind === "custom";

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-emerald-600" /> AI Providers — Add Provider (OmniRoute-Style)
        </h3>
        <Button variant="outline" size="sm" onClick={refreshStatus} disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh status
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Local Ollama is always first. External providers below are fallback-only, for non-personal content drafts,
        and need both owner switches on the server. Adding a provider is a <strong>server .env option by design</strong> —
        this page builds the exact config for you; API keys are never saved in the browser or database.
      </p>

      {/* Live status */}
      <div className="rounded-lg bg-muted/40 p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold">Live provider status</span>
          {external && (
            <Badge variant={external.configured ? "default" : "outline"} className="text-[10px]">
              {external.enabled ? (external.configured ? "External fallback ready" : "Enabled — no provider configured") : "External AI disabled"}
            </Badge>
          )}
          {external && <span className="text-[10px] text-muted-foreground">chain: {external.order.join(" → ") || "—"}</span>}
        </div>
        {statusError ? (
          <p className="text-xs text-rose-600">{statusError}</p>
        ) : !external ? (
          <div className="h-10 animate-pulse bg-muted rounded" />
        ) : (
          <div className="space-y-1">
            {external.providers.map((p) => (
              <div key={p.provider} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${p.configured ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className="font-medium">{p.provider}</span>
                  <Badge variant="outline" className="text-[9px]">{p.kind}</Badge>
                  <span className="text-muted-foreground truncate">{p.model}</span>
                </div>
                <span className="text-muted-foreground shrink-0">{REASON_LABEL[p.reason] ?? p.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add provider builder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Provider type</Label>
            <Select value={kind} onValueChange={(v) => pickKind(v as ProviderFormKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="omniroute">OmniRoute (self-hosted gateway)</SelectItem>
                <SelectItem value="custom">Custom gateway (LiteLLM / 9router / LM Studio / vLLM…)</SelectItem>
                <SelectItem value="groq">Groq (free tier)</SelectItem>
                <SelectItem value="llm7">LLM7 (free token)</SelectItem>
                <SelectItem value="opencode">OpenCode Zen (free models)</SelectItem>
                <SelectItem value="openrouter">OpenRouter (free models)</SelectItem>
              </SelectContent>
            </Select>
            {kind !== "custom" && kind !== "omniroute" && (
              <p className="text-[11px] text-muted-foreground mt-1">Get a key: {BUILTIN_PROVIDER_DEFAULTS[kind].keyUrl}</p>
            )}
            {kind === "omniroute" && (
              <p className="text-[11px] text-muted-foreground mt-1">Run OmniRoute yourself first (Docker command below), create a key in its dashboard, then fill this in.</p>
            )}
          </div>

          {kind === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Provider ID *</Label>
                <Input value={customId} onChange={(e) => setCustomId(e.target.value)} placeholder="my-gateway" />
              </div>
              <div>
                <Label className="text-xs">Display name</Label>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="My Gateway" />
              </div>
            </div>
          )}

          {isGateway && (
            <div>
              <Label className="text-xs">Gateway base URL *</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:20128/v1" />
              <p className="text-[11px] text-muted-foreground mt-1">Public gateways must use https:// — plain http only for localhost/private hosts.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Model {kind === "custom" ? "*" : ""}</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={kind === "omniroute" ? "auto" : "model id"} />
            </div>
            {kind === "custom" && (
              <div>
                <Label className="text-xs">API key env name</Label>
                <Input value={apiKeyEnv} onChange={(e) => setApiKeyEnv(e.target.value)} placeholder="MY_GATEWAY_API_KEY" />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1.5"><KeyRound className="h-3 w-3" /> API key (optional — only used to build the copy snippet below)</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder="Paste key to include it in the snippet"
                autoComplete="off"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? "Hide key" : "Show key"}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Never sent to the ALO server, never stored — it only appears in the snippet you copy.</p>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <div>
              <p className="text-xs font-medium">Try this provider first</p>
              <p className="text-[11px] text-muted-foreground">Puts it at the front of the fallback chain (local Ollama still first).</p>
            </div>
            <Switch checked={putFirst} onCheckedChange={setPutFirst} />
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800">
              A gateway (OmniRoute/custom) routes onward to whatever its operator configured — ALO cannot verify it
              stays free or where data goes. Only add gateways you run or fully trust, and never use external
              providers for student/family/comment data.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs flex items-center gap-1.5"><PlusCircle className="h-3.5 w-3.5" /> Step 1–3: copy this into the server .env, restart, then Refresh status above</Label>
            {result.ok ? (
              <pre className="text-[11px] leading-relaxed bg-zinc-950 text-zinc-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all min-h-44">{result.snippet}</pre>
            ) : (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 min-h-44">
                {result.errors.map((e) => <p key={e} className="text-[11px] text-rose-700">• {e}</p>)}
              </div>
            )}
            <Button className="mt-2 w-full" disabled={!result.ok} onClick={() => result.ok && copyText(result.snippet, "Provider .env config copied ✅")}>
              <Copy className="h-4 w-4 mr-2" /> Copy .env snippet
            </Button>
          </div>

          {kind === "omniroute" && (
            <div>
              <Label className="text-xs">Run OmniRoute itself (on your server/VPS)</Label>
              <pre className="text-[11px] leading-relaxed bg-zinc-950 text-zinc-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{OMNIROUTE_DOCKER}</pre>
              <Button variant="outline" className="mt-2 w-full" onClick={() => copyText(OMNIROUTE_DOCKER, "OmniRoute Docker command copied ✅")}>
                <Copy className="h-4 w-4 mr-2" /> Copy Docker command
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
