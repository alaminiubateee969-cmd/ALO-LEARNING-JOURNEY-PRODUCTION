"use client";

import { useMemo, useState } from "react";
import { BookOpenText, Braces, Clipboard, ExternalLink, LockKeyhole, Search, ShieldCheck, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "./primitives";
import { useToast } from "@/hooks/use-toast";
import { openApiSpec } from "@/lib/openapi-spec";

const METHOD_ORDER = ["get", "post", "patch", "delete"] as const;
const methodStyle: Record<string, string> = {
  get: "bg-sky-100 text-sky-800",
  post: "bg-emerald-100 text-emerald-800",
  patch: "bg-amber-100 text-amber-900",
  delete: "bg-rose-100 text-rose-800",
};

const browserExample = `const response = await fetch("/api/crm/leads", {
  credentials: "same-origin",
  headers: { "x-alo-company-id": "<active-workspace-id>" }
});
const data = await response.json();`;

const createExample = `const response = await fetch("/api/crm/leads", {
  method: "POST",
  credentials: "same-origin",
  headers: {
    "Content-Type": "application/json",
    "x-alo-company-id": "<active-workspace-id>"
  },
  body: JSON.stringify({
    fullName: "Example Student",
    email: "student@example.test",
    source: "website"
  })
});`;

type ApiOperation = { summary?: string; description?: string; tags?: string[]; requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> }; responses?: Record<string, unknown>; parameters?: unknown[] };

const routeList = Object.entries(openApiSpec.paths).flatMap(([path, pathItem]) =>
  METHOD_ORDER.flatMap((method) => {
    const operation = (pathItem as Record<string, unknown>)[method] as ApiOperation | undefined;
    return operation ? [{ path, method, operation }] : [];
  })
);

const componentSchemas = openApiSpec.components.schemas as Record<string, { type?: string; description?: string; properties?: Record<string, unknown>; required?: readonly string[] }>;

export default function ApiReferenceView() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [schemaOpen, setSchemaOpen] = useState("LeadCreate");

  const endpoints = useMemo(() => routeList.filter(({ path, method, operation }) => {
    const needle = query.trim().toLowerCase();
    return !needle || [path, method, operation.summary, operation.description, ...(operation.tags ?? [])].some((value) => value?.toLowerCase().includes(needle));
  }), [query]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Clipboard permission required", description: "Select the snippet and copy it manually.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-5 alo-fade-up">
      <SectionHeader
        title="API Reference"
        bn="OpenAPI 3.1"
        desc="Machine-readable endpoint contract for the admin-only CRM and quotation API. One administrator account currently controls every active workspace; workspace selection is not per-company authorization."
        icon={<BookOpenText className="h-5 w-5" />}
        action={<Button type="button" variant="outline" size="sm" onClick={() => window.open("/api/openapi.json", "_blank", "noopener,noreferrer")}><ExternalLink className="h-4 w-4" />Open OpenAPI JSON</Button>}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="flex gap-3 p-4"><div className="rounded-lg bg-amber-500/10 p-2 text-amber-700"><LockKeyhole className="h-4 w-4" /></div><div><p className="text-sm font-semibold">Admin session</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Production routes require the administrator session cookie. This is not a public API key.</p></div></Card>
        <Card className="flex gap-3 p-4"><div className="rounded-lg bg-sky-500/10 p-2 text-sky-700"><ShieldCheck className="h-4 w-4" /></div><div><p className="text-sm font-semibold">Workspace scope</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground"><code>x-alo-company-id</code> filters the single admin session to a workspace. It is not a membership token or authorization boundary; omitting it selects the first active workspace.</p></div></Card>
        <Card className="flex gap-3 p-4"><div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700"><Braces className="h-4 w-4" /></div><div><p className="text-sm font-semibold">No side effects hidden</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Quote and activity endpoints only record data. They do not publish posts or send email, SMS, or WhatsApp.</p></div></Card>
      </div>

      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><h2 className="text-base font-semibold">API operations</h2><p className="text-xs text-muted-foreground">Search by path, method, or description.</p></div>
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search endpoints…" className="pl-9" /></div>
        </div>
        <div className="space-y-2">
          {endpoints.map(({ path, method, operation }) => {
            const requestSchema = operation.requestBody?.content?.["application/json"]?.schema?.$ref?.split("/").at(-1);
            const responseCodes = Object.keys(operation.responses ?? {});
            return (
              <details key={`${method}-${path}`} className="group rounded-xl border border-border/70 bg-background open:border-amber-300 open:bg-amber-50/20 dark:open:bg-amber-950/10">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3 sm:p-4 [&::-webkit-details-marker]:hidden">
                  <Badge className={`min-w-16 justify-center uppercase ${methodStyle[method]}`}>{method}</Badge>
                  <code className="break-all text-xs font-semibold sm:text-sm">{path}</code>
                  <span className="ml-auto text-[10px] text-muted-foreground">{operation.tags?.[0]}</span>
                  <p className="w-full pl-0 text-xs text-muted-foreground sm:pl-[4.5rem]">{operation.summary}</p>
                </summary>
                <div className="space-y-3 border-t border-border/60 px-3 py-3 sm:px-4 sm:py-4">
                  {operation.description && <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">{operation.description}</p>}
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {requestSchema && <Badge variant="outline">Body schema: {requestSchema}</Badge>}
                    <Badge variant="outline">Responses: {responseCodes.join(" · ")}</Badge>
                    {method !== "get" && <Badge variant="outline">Content-Type: application/json</Badge>}
                  </div>
                  {method === "get" && path === "/api/crm/leads" && <div className="rounded-lg bg-slate-950 p-3 text-slate-100"><div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-[10px] text-slate-300"><TerminalSquare className="h-3 w-3" />Browser fetch</span><Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-slate-200 hover:bg-slate-800 hover:text-white" onClick={() => void copy(browserExample, "GET example")}><Clipboard className="h-3 w-3" />Copy</Button></div><pre className="overflow-x-auto text-[11px] leading-relaxed">{browserExample}</pre></div>}
                  {method === "post" && path === "/api/crm/leads" && <div className="rounded-lg bg-slate-950 p-3 text-slate-100"><div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-[10px] text-slate-300"><TerminalSquare className="h-3 w-3" />Create example</span><Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-slate-200 hover:bg-slate-800 hover:text-white" onClick={() => void copy(createExample, "POST example")}><Clipboard className="h-3 w-3" />Copy</Button></div><pre className="overflow-x-auto text-[11px] leading-relaxed">{createExample}</pre></div>}
                </div>
              </details>
            );
          })}
          {!endpoints.length && <p className="py-8 text-center text-sm text-muted-foreground">No endpoints match this search.</p>}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2"><Braces className="h-4 w-4 text-violet-600" /><div><h2 className="text-base font-semibold">Request schemas</h2><p className="text-xs text-muted-foreground">Browse the same component definitions served in the OpenAPI JSON.</p></div></div>
        <div className="space-y-2">
          {Object.entries(componentSchemas).filter(([name]) => ["Lead", "LeadCreate", "LeadUpdate", "LeadStage", "ConsentStatus", "ActivityCreate", "QuotationCreate", "QuotationItemCreate", "QuoteStatus"].includes(name)).map(([name, schema]) => {
            const opened = schemaOpen === name;
            const properties = schema.properties ? Object.entries(schema.properties) : [];
            return <section key={name} className="rounded-xl border border-border/70">
              <button type="button" className="flex w-full items-center justify-between gap-2 p-3 text-left" aria-expanded={opened} onClick={() => setSchemaOpen(opened ? "" : name)}><span><code className="text-sm font-semibold">{name}</code><span className="ml-2 text-[10px] text-muted-foreground">{schema.type ?? "schema"}</span></span><span className="text-xs text-muted-foreground">{opened ? "−" : "+"}</span></button>
              {opened && <div className="border-t border-border/60 p-3">{schema.description && <p className="mb-2 text-xs text-muted-foreground">{schema.description}</p>}{properties.length ? <div className="grid gap-1 sm:grid-cols-2">{properties.map(([property, definition]) => <div key={property} className="rounded-md bg-muted/35 px-2.5 py-1.5 text-xs"><code className="font-semibold">{property}</code><span className="ml-2 text-muted-foreground">{JSON.stringify(definition)}</span></div>)}</div> : <p className="text-xs text-muted-foreground">{JSON.stringify(schema)}</p>}</div>}
            </section>;
          })}
        </div>
      </Card>

      <p className="text-[11px] leading-relaxed text-muted-foreground">Production setup still requires a configured admin secret and password hash, database migration, HTTPS, and end-to-end verification. This reference describes application code—not a guarantee that external services are connected.</p>
    </div>
  );
}
