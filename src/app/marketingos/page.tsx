/**
 * ALO Labs MarketingOS — Marketing Landing Page (served at /marketingos)
 *
 * Moved from `/` (where PR #27 had replaced the ALO admin console) so that
 * `/` is the ALO Learning Journey console again on learn.aloeducation.com.
 *
 * Server Component (no 'use client' at top) so the page statically renders.
 * Client interactivity is provided by importing shadcn's <Sheet> (mobile menu)
 * and <Accordion> (FAQ) — both are already 'use client' components, which act
 * as client islands inside this server-rendered tree.
 */

import Link from "next/link";
import Image from "next/image";
import {
  Menu,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  PlayCircle,
  Bot,
  Megaphone,
  Users,
  Palette,
  Search,
  Inbox,
  Plug,
  Check,
  Twitter,
  Linkedin,
  Github,
  Star,
  ShieldCheck,
  Lock,
  Building2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "AI Agents", href: "#agents" },
  { label: "Integrations", href: "#integrations" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#docs" },
  { label: "Blog", href: "#blog" },
] as const;

const TRUST_LOGOS = [
  "Northwind",
  "Acme Co",
  "Helios",
  "Quanta",
  "Vertex",
  "Lumen",
] as const;

const STATS = [
  { value: "35", label: "Specialized AI Agents" },
  { value: "120+", label: "Native Integrations" },
  { value: "Free", label: "AI Models — Z.AI, Groq, Gemini, Ollama" },
  { value: "10 min", label: "Average Setup Time" },
] as const;

type Feature = {
  icon: typeof Bot;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    icon: Bot,
    title: "AI Workforce",
    description:
      "35 specialized AI agents ready to deploy across marketing, content, social, video, and CRM.",
  },
  {
    icon: Megaphone,
    title: "Multi-Channel Publishing",
    description:
      "Schedule and publish to Facebook, Instagram, LinkedIn, X, TikTok, and YouTube from one calendar.",
  },
  {
    icon: Users,
    title: "CRM + Lead Scoring",
    description:
      "AI-scored leads, kanban pipeline, and enrichment so your sales team only sees what matters.",
  },
  {
    icon: Palette,
    title: "Creative Studio",
    description:
      "Text-to-image, text-to-video, AI voiceover, and auto-captions — all generated in-platform.",
  },
  {
    icon: Search,
    title: "SEO Engine",
    description:
      "60-day growth challenge with keyword tracking, content briefs, and SERP monitoring built in.",
  },
  {
    icon: Inbox,
    title: "Unified Inbox",
    description:
      "Social DMs, SMS, and email collapsed into one queue with AI-drafted replies and routing.",
  },
];

type Agent = {
  initials: string;
  name: string;
  role: string;
  gradient: string;
};

const AGENTS: Agent[] = [
  { initials: "MD", name: "Aria", role: "Marketing Director", gradient: "from-orange-400 to-orange-600" },
  { initials: "CW", name: "Sam", role: "Content Writer", gradient: "from-blue-400 to-blue-600" },
  { initials: "SS", name: "Nova", role: "SEO Specialist", gradient: "from-purple-400 to-purple-600" },
  { initials: "VD", name: "Kai", role: "Video Director", gradient: "from-pink-400 to-pink-600" },
  { initials: "CV", name: "Reel", role: "Cinematic Video Creator", gradient: "from-amber-400 to-amber-600" },
  { initials: "VS", name: "Luna", role: "Voiceover Specialist", gradient: "from-teal-400 to-teal-600" },
  { initials: "CM", name: "Jude", role: "CRM Manager", gradient: "from-rose-400 to-rose-600" },
  { initials: "SP", name: "Iris", role: "Social Media Publisher", gradient: "from-indigo-400 to-indigo-600" },
  { initials: "EM", name: "Theo", role: "Email Marketer", gradient: "from-emerald-400 to-emerald-600" },
  { initials: "AO", name: "Wren", role: "Ad Optimizer", gradient: "from-cyan-400 to-cyan-600" },
  { initials: "AE", name: "Otis", role: "Analytics Engineer", gradient: "from-fuchsia-400 to-fuchsia-600" },
  { initials: "BS", name: "Mira", role: "Brand Strategist", gradient: "from-lime-400 to-lime-600" },
];

const STEPS = [
  {
    number: "01",
    title: "Connect your accounts",
    description:
      "Securely OAuth into Google, Meta, LinkedIn, TikTok, YouTube, and 120+ other tools. No API keys to manage.",
  },
  {
    number: "02",
    title: "Assign tasks to AI agents",
    description:
      "Pick from 35 specialized AI agents — content writer, video director, CRM manager — and brief them in plain English.",
  },
  {
    number: "03",
    title: "Review and approve",
    description:
      "Every output lands in a unified queue for your approval. Publish, schedule, or send back for revisions in one click.",
  },
] as const;

const INTEGRATIONS = [
  "Google", "Meta", "LinkedIn", "X", "TikTok", "YouTube",
  "WordPress", "Shopify", "HubSpot", "Mailchimp", "SendGrid", "Stripe",
] as const;

type PricingTier = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  popular?: boolean;
};

const PRICING: PricingTier[] = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    description: "For solo founders and small teams exploring AI marketing.",
    features: [
      "3 AI agents included",
      "100 API calls / month",
      "2 social channels",
      "Free AI models (Z.AI, Groq)",
      "Community support",
    ],
    cta: "Start Free",
    ctaHref: "/dashboard",
  },
  {
    name: "Professional",
    price: "$99",
    period: "per month",
    description: "For marketing teams scaling multi-channel campaigns.",
    features: [
      "All 35 AI agents",
      "Unlimited API calls",
      "10 social channels",
      "All free AI models + bring your own",
      "CRM + Lead Scoring",
      "Priority support",
    ],
    cta: "Start Free Trial",
    ctaHref: "/dashboard",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual",
    description: "For agencies and brands with advanced security needs.",
    features: [
      "Everything in Professional",
      "Self-hosted option (Docker)",
      "SSO + SCIM provisioning",
      "Dedicated success manager",
      "Custom AI model fine-tuning",
      "99.9% uptime SLA",
    ],
    cta: "Talk to Sales",
    ctaHref: "#contact",
  },
];

type Testimonial = {
  quote: string;
  initials: string;
  name: string;
  title: string;
  company: string;
  gradient: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "We replaced three SaaS subscriptions with ALO Labs and shipped our Q4 campaign two weeks early. The AI agents handle everything from SEO briefs to voiceovers without a single freelancer.",
    initials: "MR",
    name: "Maya Rodriguez",
    title: "CMO",
    company: "Northwind",
    gradient: "from-orange-400 to-orange-600",
  },
  {
    quote:
      "The CRM lead scoring alone paid for itself in week one. Our sales team now only talks to prospects the AI has already qualified — conversion is up 27%.",
    initials: "DK",
    name: "Daniel Kim",
    title: "Founder & CEO",
    company: "Vertex",
    gradient: "from-blue-400 to-blue-600",
  },
  {
    quote:
      "I run a five-person marketing team that now produces the output of a fifty-person agency. The AI workforce is genuinely transformative for our economics.",
    initials: "AP",
    name: "Aisha Patel",
    title: "VP Marketing",
    company: "Helios",
    gradient: "from-purple-400 to-purple-600",
  },
];

const FAQS = [
  {
    q: "Do I need to provide my own AI API keys?",
    a: "No. We ship with free Z.AI, Groq, Gemini, and Ollama models pre-configured and ready to use. If you want additional providers, you can add your own free OpenRouter or OpenCode keys in the Super Admin — but it is never required to get started.",
  },
  {
    q: "Is WhatsApp supported?",
    a: "No. Per our architecture, AI agents handle all communication channels including web chat, email, SMS, and social DMs. This keeps the platform focused, predictable, and free of WhatsApp Business API licensing overhead.",
  },
  {
    q: "Can I self-host?",
    a: "Yes. The full stack is open-source friendly and ships as a Docker compose bundle that runs on a single Ubuntu server. Enterprise customers can deploy fully air-gapped behind their own VPN.",
  },
  {
    q: "How are credentials stored?",
    a: "Every integration credential, API key, and OAuth token is encrypted at rest using AES-256-GCM envelope encryption. Tokens are never stored in plaintext and never logged.",
  },
  {
    q: "What about tenant isolation?",
    a: "Multi-tenant isolation is enforced at the database layer using PostgreSQL Row Level Security, scoped API credentials per tenant, and isolated per-tenant background workers. One tenant cannot ever see another tenant's data.",
  },
  {
    q: "Is there a free tier?",
    a: "Yes — the Starter plan is free forever and includes 3 AI agents, 100 API calls per month, and 2 social channels. No credit card required to sign up.",
  },
] as const;

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Integrations", href: "#integrations" },
      { label: "Changelog", href: "#changelog" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Blog", href: "#blog" },
      { label: "Careers", href: "#careers" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "#docs" },
      { label: "API Reference", href: "#api" },
      { label: "Status", href: "#status" },
      { label: "Community", href: "#community" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#privacy" },
      { label: "Terms", href: "#terms" },
      { label: "Security", href: "#security" },
      { label: "GDPR", href: "#gdpr" },
    ],
  },
] as const;

/* ------------------------------------------------------------------ */
/* Mobile nav                                                          */
/* ------------------------------------------------------------------ */

function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Image
              src="/kexsio-logo.png"
              alt="ALO Labs logo"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span>ALO Labs</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4" aria-label="Mobile navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 p-4">
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Sign In</Link>
          </Button>
          <Button
            asChild
            className="w-full bg-orange-500 text-white hover:bg-orange-600"
          >
            <Link href="/dashboard">Get Started</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function MarketingOsLandingPage() {
  return (
    <div className="mos-theme min-h-screen bg-white text-slate-900 antialiased">
      {/* ---------- 1. Sticky top nav ---------- */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/marketingos" className="flex items-center gap-2" aria-label="ALO Labs MarketingOS home">
            <Image
              src="/kexsio-logo.png"
              alt="ALO Labs logo"
              width={32}
              height={32}
              className="rounded-md"
              priority
            />
            <span className="text-base font-bold tracking-tight text-slate-900">
              ALO Labs
            </span>
          </Link>

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Primary navigation"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Sign In</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              <Link href="/dashboard">
                Get Started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <MobileNav />
        </div>
      </header>

      <main>
        {/* ---------- 2. Hero ---------- */}
        <section className="relative overflow-hidden">
          {/* Background gradients */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
            <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute left-0 top-60 h-80 w-80 rounded-full bg-orange-400/10 blur-3xl" />
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-28">
            <div className="mx-auto max-w-3xl text-center">
              <Badge
                variant="outline"
                className="mb-6 border-orange-200 bg-orange-50 text-orange-700"
              >
                <Sparkles className="size-3.5" />
                Now generally available — 35 AI agents ready to deploy
              </Badge>

              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Your AI Workforce,
                <br />
                <span className="bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
                  Ready to Deploy.
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl">
                35 specialized AI agents that handle marketing, content, social,
                video, SEO, CRM, and customer support — all on one platform.
                Replace your tool stack with a workforce that never sleeps.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-orange-500 text-white hover:bg-orange-600 sm:w-auto"
                >
                  <Link href="/dashboard">
                    Start Free Trial
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full border-slate-300 sm:w-auto"
                >
                  <Link href="#demo">
                    <PlayCircle className="size-4" />
                    Watch Demo
                  </Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-orange-500" />
                  No credit card required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-orange-500" />
                  Free AI models
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-orange-500" />
                  Self-hosted option
                </span>
              </div>
            </div>

            {/* Hero visual — CSS-only abstract dashboard mockup */}
            <div className="relative mx-auto mt-16 max-w-5xl">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-orange-500/10">
                {/* Mock browser bar */}
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="size-3 rounded-full bg-red-400" />
                  <span className="size-3 rounded-full bg-yellow-400" />
                  <span className="size-3 rounded-full bg-green-400" />
                  <div className="ml-4 hidden flex-1 items-center rounded-md bg-white px-3 py-1 text-xs text-slate-400 sm:flex">
                    app.alolabs.net/dashboard
                  </div>
                </div>

                {/* Mock dashboard body */}
                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3 sm:p-6">
                  {/* Stat cards */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-medium text-slate-500">
                      Active Agents
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">
                      12 / 35
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-2/3 rounded-full bg-orange-500" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-medium text-slate-500">
                      Campaigns Live
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">
                      8
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <ArrowRight className="size-3 rotate-[-45deg]" />
                      +27% this week
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-medium text-slate-500">
                      Inbound Leads
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">
                      1,284
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600">
                      <ArrowRight className="size-3 rotate-[-45deg]" />
                      AI-scored in real time
                    </div>
                  </div>

                  {/* Activity panel */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4 sm:col-span-3">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">
                        AI Agent Activity
                      </div>
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />
                        Live
                      </Badge>
                    </div>
                    <ul className="space-y-2">
                      {AGENTS.slice(0, 4).map((agent) => (
                        <li
                          key={agent.name}
                          className="flex items-center gap-3 rounded-md p-2 hover:bg-slate-50"
                        >
                          <div
                            className={`flex size-8 items-center justify-center rounded-full bg-gradient-to-br ${agent.gradient} text-xs font-bold text-white`}
                            aria-hidden="true"
                          >
                            {agent.initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-slate-900">
                              {agent.name} — {agent.role}
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              Drafted 3 posts, optimized 7 keywords
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            Active
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Floating accent cards */}
              <div className="absolute -left-4 -top-4 hidden rotate-[-6deg] rounded-xl border border-slate-200 bg-white p-3 shadow-lg sm:block">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-orange-500 text-white">
                    <Bot className="size-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      Agent deployed
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Marketing Director
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 hidden rotate-[6deg] rounded-xl border border-slate-200 bg-white p-3 shadow-lg sm:block">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-blue-500 text-white">
                    <Star className="size-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      +27% conversion
                    </div>
                    <div className="text-[10px] text-slate-500">
                      This week
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 3. Logos / social proof bar ---------- */}
        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
              Trusted by modern marketing teams
            </p>
            <div className="mt-6 grid grid-cols-2 items-center justify-items-center gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
              {TRUST_LOGOS.map((logo) => (
                <div
                  key={logo}
                  className="text-lg font-bold tracking-tight text-slate-400 transition-colors hover:text-slate-600"
                >
                  {logo}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 4. Stats band ---------- */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl font-extrabold text-orange-500 sm:text-4xl lg:text-5xl">
                    {stat.value}
                  </div>
                  <div className="mt-2 text-sm text-slate-600 sm:text-base">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 5. Features grid ---------- */}
        <section id="features" className="bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge
                variant="outline"
                className="mb-4 border-orange-200 bg-orange-50 text-orange-700"
              >
                Platform
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Everything your marketing team needs
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                One platform replaces a dozen disconnected tools — from creative
                production to CRM, SEO, and multi-channel publishing.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-500/10"
                  >
                    <div className="flex size-12 items-center justify-center rounded-xl bg-orange-50 text-orange-500 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                      <Icon className="size-6" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------- 6. AI Agents showcase ---------- */}
        <section id="agents" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge
                variant="outline"
                className="mb-4 border-blue-200 bg-blue-50 text-blue-700"
              >
                <Bot className="size-3.5" />
                AI Workforce
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Meet your AI workforce
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                35 specialized agents — each an expert in their craft. A
                representative subset is shown below; the full roster lives
                inside the platform.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {AGENTS.map((agent) => (
                <div
                  key={agent.name}
                  className="rounded-2xl border border-slate-200 bg-white p-5 text-center transition-all duration-200 hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg"
                >
                  <span
                    className={`mx-auto flex size-16 items-center justify-center rounded-full bg-gradient-to-br ${agent.gradient} text-lg font-bold text-white shadow-md`}
                    aria-hidden="true"
                  >
                    {agent.initials}
                  </span>
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-900">
                      {agent.name}
                    </span>
                    <span
                      className="inline-block size-1.5 rounded-full bg-emerald-500"
                      aria-hidden="true"
                    />
                    <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">
                      Active
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {agent.role}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Button asChild variant="outline" className="border-slate-300">
                <Link href="/dashboard">
                  View all 35 agents
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ---------- 7. How it works ---------- */}
        <section className="bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge
                variant="outline"
                className="mb-4 border-orange-200 bg-orange-50 text-orange-700"
              >
                How it works
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Deploy your workforce in three steps
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                From zero to a fully-staffed AI marketing team in under ten
                minutes.
              </p>
            </div>

            <div className="relative mt-16">
              {/* Connecting line on desktop */}
              <div
                aria-hidden="true"
                className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-orange-200 via-blue-200 to-orange-200 lg:block"
              />
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
                {STEPS.map((step) => (
                  <div key={step.number} className="relative text-center">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-orange-500 text-lg font-bold text-white shadow-lg shadow-orange-500/30 ring-8 ring-slate-50">
                      {step.number}
                    </div>
                    <h3 className="mt-6 text-lg font-semibold text-slate-900">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 8. Integrations marquee ---------- */}
        <section id="integrations" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge
                variant="outline"
                className="mb-4 border-blue-200 bg-blue-50 text-blue-700"
              >
                <Plug className="size-3.5" />
                Integrations
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Works with your favorite tools
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                120+ native OAuth integrations across social, commerce, CRM,
                email, and payments.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {INTEGRATIONS.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md"
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 9. Pricing ---------- */}
        <section id="pricing" className="bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge
                variant="outline"
                className="mb-4 border-orange-200 bg-orange-50 text-orange-700"
              >
                Pricing
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Start free. Upgrade when you grow. Cancel anytime.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
              {PRICING.map((tier) => (
                <div
                  key={tier.name}
                  className={`relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm transition-all ${
                    tier.popular
                      ? "border-orange-500 shadow-xl shadow-orange-500/10 lg:-translate-y-4 lg:scale-105"
                      : "border-slate-200 hover:border-orange-300 hover:shadow-lg"
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-orange-500 px-3 py-1 text-xs font-semibold text-white shadow-md">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {tier.name}
                    </h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-slate-900">
                        {tier.price}
                      </span>
                      <span className="text-sm text-slate-500">
                        /{tier.period}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {tier.description}
                    </p>
                  </div>

                  <ul className="mt-6 flex-1 space-y-3">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-slate-700"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-orange-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    <Button
                      asChild
                      className={`w-full ${
                        tier.popular
                          ? "bg-orange-500 text-white hover:bg-orange-600"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      <Link href={tier.ctaHref}>{tier.cta}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 10. Testimonials ---------- */}
        <section className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge
                variant="outline"
                className="mb-4 border-orange-200 bg-orange-50 text-orange-700"
              >
                <Star className="size-3.5" />
                Customer stories
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Loved by marketing teams everywhere
              </h2>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <figure
                  key={t.name}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex items-center gap-1 text-orange-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="flex-1 text-sm leading-relaxed text-slate-700">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
                    <span
                      className={`flex size-10 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-sm font-bold text-white`}
                      aria-hidden="true"
                    >
                      {t.initials}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {t.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t.title}, {t.company}
                      </div>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 11. FAQ accordion ---------- */}
        <section id="docs" className="bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <Badge
                variant="outline"
                className="mb-4 border-blue-200 bg-blue-50 text-blue-700"
              >
                FAQ
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Everything you need to know about the product and billing.
              </p>
            </div>

            <div className="mt-12 rounded-2xl border border-slate-200 bg-white px-6 py-2">
              <Accordion type="single" collapsible className="w-full">
                {FAQS.map((faq, i) => (
                  <AccordionItem
                    key={faq.q}
                    value={`item-${i}`}
                    className="border-b border-slate-200 last:border-b-0"
                  >
                    <AccordionTrigger className="text-left text-base font-medium text-slate-900 hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-slate-600">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Trust mini-row */}
            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <ShieldCheck className="size-6 text-orange-500" />
                <div className="text-sm">
                  <div className="font-semibold text-slate-900">SOC 2 Type II</div>
                  <div className="text-slate-500">In progress</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <Lock className="size-6 text-orange-500" />
                <div className="text-sm">
                  <div className="font-semibold text-slate-900">AES-256-GCM</div>
                  <div className="text-slate-500">Envelope encryption</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <Building2 className="size-6 text-orange-500" />
                <div className="text-sm">
                  <div className="font-semibold text-slate-900">PostgreSQL RLS</div>
                  <div className="text-slate-500">Tenant isolation</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 12. Final CTA band ---------- */}
        <section id="contact" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-16 text-center shadow-2xl shadow-orange-500/20 sm:px-16 sm:py-20">
              {/* Decorative blobs */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              >
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
              </div>

              <div className="relative">
                <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Ready to deploy your AI workforce?
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-orange-50">
                  Start free today. Add a credit card later only when you
                  outgrow the Starter plan.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="w-full bg-white text-orange-600 hover:bg-orange-50 sm:w-auto"
                  >
                    <Link href="/dashboard">
                      Start Free
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="w-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
                  >
                    <Link href="#contact">Talk to Sales</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- 13. Footer ---------- */}
      <footer id="blog" className="border-t border-slate-200 bg-slate-900 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-6">
            {/* Brand column */}
            <div className="col-span-2 lg:col-span-2">
              <Link href="/marketingos" className="flex items-center gap-2" aria-label="ALO Labs MarketingOS home">
                <Image
                  src="/kexsio-logo.png"
                  alt="ALO Labs logo"
                  width={32}
                  height={32}
                  className="rounded-md"
                />
                <span className="text-base font-bold text-white">ALO Labs</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm text-slate-400">
                The enterprise AI workforce platform. Deploy 35 specialized AI
                agents across marketing, content, social, video, SEO, and CRM.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Link
                  href="https://twitter.com"
                  aria-label="ALO Labs on Twitter"
                  className="flex size-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-orange-500 hover:text-white"
                >
                  <Twitter className="size-4" />
                </Link>
                <Link
                  href="https://linkedin.com"
                  aria-label="ALO Labs on LinkedIn"
                  className="flex size-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-orange-500 hover:text-white"
                >
                  <Linkedin className="size-4" />
                </Link>
                <Link
                  href="https://github.com"
                  aria-label="ALO Labs on GitHub"
                  className="flex size-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-orange-500 hover:text-white"
                >
                  <Github className="size-4" />
                </Link>
              </div>
            </div>

            {/* Link columns */}
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {col.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-slate-300 transition-colors hover:text-orange-400"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row">
            <p className="text-xs text-slate-500">
              &copy; 2026 ALO Labs. All rights reserved.
            </p>
            <p className="text-xs text-slate-500">
              marketing.alolabs.net
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
