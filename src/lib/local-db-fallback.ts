import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DB_FILE = process.env.ALO_LOCAL_DB_FILE?.trim()
  ? path.resolve(process.env.ALO_LOCAL_DB_FILE.trim())
  : path.join(process.cwd(), "storage", "local-db.json");

export const MODEL_NAMES = [
  "company",
  "aIAgentRun",
  "adminOtpChallenge",
  "contentIdea",
  "contentPackage",
  "approvalItem",
  "socialConnection",
  "ragDocument",
  "ragChunk",
  "analyticsSnapshot",
  "telegramCommand",
  "auditLog",
  "notification",
  "familyModel",
  "publishedPost",
  "commentInbox",
  "department",
  "agentEmployee",
  "loopCycle",
  "familyProfile",
  "familyReferenceAsset",
  "familyProject",
  "mediaGeneration",
  "contentOpportunityScore",
  "hookTest",
  "campaign",
  "inkboxIntegration",
  "agentMessage",
  "lead",
  "leadActivity",
  "quotation",
  "quotationItem",
  "client",
  "project",
  "invoice",
  "marketingCampaign",
  "marketingLead",
  "otpRequest",
  "voiceGeneration",
  "audioTranscription",
  "humanAvatar",
  "avatarVideo",
] as const;

export type ModelName = (typeof MODEL_NAMES)[number];

const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "startedAt",
  "finishedAt",
  "expiresAt",
  "consumedAt",
  "sentAt",
  "windowStartedAt",
  "reviewedAt",
  "tokenExpiry",
  "lastSyncAt",
  "capturedAt",
  "consentDate",
  "publishedAt",
  "scheduledAt",
  "repliedAt",
  "completedAt",
  "uploadedAt",
  "testedAt",
  "measuredAt",
  "lastHealthCheck",
  "deliveredAt",
  "consentRecordedAt",
  "nextFollowUp",
  "validUntil",
  "acceptedAt",
  "verifiedAt",
  "deadline",
  "dueDate",
  "paidAt",
]);

const MODEL_DEFAULTS: Record<ModelName, () => Record<string, any>> = {
  company: () => ({ domain: null, logoUrl: null, plan: "growth", active: true, createdAt: new Date(), updatedAt: new Date() }),
  aIAgentRun: () => ({ status: "idle", inputBrief: null, outputJson: null, errorMsg: null, retryCount: 0, costEstUsd: 0, startedAt: null, finishedAt: null, createdAt: new Date() }),
  adminOtpChallenge: () => ({ consumedAt: null, failedAttempts: 0, sentAt: null, windowStartedAt: new Date(), sendCount: 0 }),
  contentIdea: () => ({ ragSources: null, status: "idea", createdAt: new Date() }),
  contentPackage: () => ({ ideaId: null, seoKeywords: null, hashtagsJson: null, imagePrompt: null, voiceDirection: null, disclaimerBn: null, qualityScore: 0, safetyStatus: "pending", ragCitations: null, createdAt: new Date() }),
  approvalItem: () => ({ packageId: null, type: "content", riskLevel: "low", blockedReasons: null, requiredEdits: null, status: "pending", reviewerNote: null, createdAt: new Date(), reviewedAt: null }),
  socialConnection: () => ({ handle: null, status: "not_connected", scopesJson: null, tokenExpiry: null, lastSyncAt: null, createdAt: new Date(), updatedAt: new Date() }),
  ragDocument: () => ({ sourceType: "manual", sourceUrl: null, tagsJson: null, chunkCount: 0, createdAt: new Date() }),
  ragChunk: () => ({ keywordsJson: null, createdAt: new Date() }),
  analyticsSnapshot: () => ({ capturedAt: new Date() }),
  telegramCommand: () => ({ args: null, status: "received", response: null, createdAt: new Date() }),
  auditLog: () => ({ actor: "system", detail: null, severity: "info", createdAt: new Date() }),
  notification: () => ({ kind: "info", read: false, createdAt: new Date() }),
  familyModel: () => ({ consentConfirmed: false, consentDate: null, referenceImages: null, voiceSample: null, appearanceJson: null, voiceSettingsJson: null, active: true, createdAt: new Date() }),
  publishedPost: () => ({ providerPostId: null, url: null, status: "queued", createdAt: new Date(), publishedAt: null, scheduledAt: null, packageId: null }),
  commentInbox: () => ({ authorHandle: null, postTopic: null, category: "safe_general", riskLevel: "low", status: "new", draftReply: null, createdAt: new Date(), repliedAt: null }),
  department: () => ({ description: null, agentCount: 0, active: true, createdAt: new Date() }),
  agentEmployee: () => ({ modelProvider: "local", modelName: "local", qualityScore: 0, successRate: 0, status: "idle", sopCoverage: 0, maxAttempts: 3, createdAt: new Date() }),
  loopCycle: () => ({ phase: "observe", status: "running", agentsUsed: null, qualityScore: 0, retryCount: 0, costUsd: 0, errorType: null, lesson: null, startedAt: new Date(), completedAt: null }),
  familyProfile: () => ({ consentConfirmed: false, consentDate: null, guardianName: null, voiceConsent: false, faceConsent: false, appearanceJson: null, voiceSettingsJson: null, active: true, createdAt: new Date() }),
  familyReferenceAsset: () => ({ angleType: null, context: null, expression: null, lighting: null, clothing: null, hairstyle: null, fileName: null, fileSize: 0, mimeType: null, qualityScore: 0, isDuplicate: false, approved: false, uploadedAt: new Date() }),
  familyProject: () => ({ description: null, status: "draft", qualityScore: 0, currentStage: null, outputJson: null, createdAt: new Date(), updatedAt: new Date() }),
  mediaGeneration: () => ({ projectId: null, inputJson: null, outputJson: null, qualityScore: 0, identityScore: 0, provider: "local", status: "pending", attempt: 1, maxAttempts: 3, issuesJson: null, createdAt: new Date() }),
  contentOpportunityScore: () => ({ searchDemand: 0, parentRelevance: 0, bangladeshRelevance: 0, competition: 0, videoPotential: 0, brandFit: 0, finalScore: 0, rationale: null, approved: false, provider: "local", createdAt: new Date() }),
  hookTest: () => ({ variant: "A", impressions: 0, hookRetention: 0, watchTime: 0, completion: 0, isWinner: false, status: "draft", createdAt: new Date(), testedAt: null }),
  campaign: () => ({ opportunityId: null, status: "planned", platformCount: 0, totalAssets: 0, views: 0, reach: 0, engagement: 0, followerGain: 0, audienceRelevance: 0, conversionRate: 0, lesson: null, createdAt: new Date(), publishedAt: null, measuredAt: null }),
  inkboxIntegration: () => ({ inkboxIdentityId: null, channels: "[]", status: "not_connected", configJson: null, lastHealthCheck: null, lastError: null, createdAt: new Date(), updatedAt: new Date() }),
  agentMessage: () => ({ taskId: null, context: null, requiredOutput: null, priority: "normal", status: "pending", result: null, failureReason: null, hopCount: 0, channel: "internal", inkboxMessageId: null, createdAt: new Date(), deliveredAt: null, completedAt: null }),
  lead: () => ({ email: null, phone: null, targetCountry: null, studyLevel: null, courseInterest: null, intake: null, source: "website", stage: "new", consentStatus: "unknown", consentRecordedAt: null, nextFollowUp: null, notes: null, createdAt: new Date(), updatedAt: new Date() }),
  leadActivity: () => ({ type: "note", actor: "admin", createdAt: new Date() }),
  quotation: () => ({ currency: "GBP", status: "draft", subtotal: "0.00", discountAmount: "0.00", taxRate: "0.00", taxAmount: "0.00", total: "0.00", validUntil: null, terms: null, notes: null, acceptedAt: null, createdAt: new Date(), updatedAt: new Date() }),
  quotationItem: () => ({ quantity: 1, unitPrice: "0.00", lineTotal: "0.00", position: 0 }),
  client: () => ({ phone: null, company: null, type: "individual", status: "active", notes: null, createdAt: new Date(), updatedAt: new Date() }),
  project: () => ({ status: "inquiry", budget: null, deadline: null, description: null, createdAt: new Date(), updatedAt: new Date() }),
  invoice: () => ({ projectId: null, currency: "BDT", status: "draft", dueDate: null, paidAt: null, itemsJson: null, createdAt: new Date() }),
  marketingCampaign: () => ({ status: "draft", audienceJson: null, content: null, scheduledAt: null, sentCount: 0, openCount: 0, clickCount: 0, createdAt: new Date() }),
  marketingLead: () => ({ email: null, phone: null, company: null, source: "website", service: null, budget: null, status: "new", assignedTo: null, notes: null, tagsJson: null, createdAt: new Date(), updatedAt: new Date() }),
  otpRequest: () => ({ purpose: "verification", status: "pending", attempts: 0, maxAttempts: 5, verifiedAt: null, metadataJson: null, createdAt: new Date() }),
  voiceGeneration: () => ({ speed: 1, volume: 1, format: "wav", language: "bn", filePath: null, durationSec: null, charCount: 0, status: "pending", errorMessage: null, createdAt: new Date() }),
  audioTranscription: () => ({ language: "auto", transcription: null, wordCount: 0, durationSec: null, status: "pending", errorMessage: null, createdAt: new Date() }),
  humanAvatar: () => ({ ownerId: "dev-admin", ethnicity: "south-asian", voiceSpeed: 0.95, backgroundStory: null, consistencySeed: null, portraitUrl: null, portraitStatus: "pending", outfitStyle: null, sceneContext: null, active: true, videoCount: 0, createdAt: new Date(), updatedAt: new Date() }),
  avatarVideo: () => ({ ownerId: "dev-admin", script: null, scenesJson: null, actualDuration: null, videoUrl: null, thumbnailUrl: null, status: "pending", progress: 0, currentStep: null, errorMessage: null, lipSyncUsed: false, lipSyncReason: null, quality: "standard", createdAt: new Date(), updatedAt: new Date() }),
};

const UPDATED_AT_MODELS = new Set<ModelName>([
  "company",
  "socialConnection",
  "familyProject",
  "inkboxIntegration",
  "lead",
  "quotation",
  "client",
  "project",
  "marketingLead",
  "humanAvatar",
  "avatarVideo",
]);

type StoreData = Record<ModelName, Record<string, any>[]>;

function reviveRecord(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...row };
  for (const key of Object.keys(out)) {
    if (DATE_FIELDS.has(key) && out[key] !== null && out[key] !== undefined) {
      out[key] = out[key] instanceof Date ? out[key] : new Date(out[key]);
    }
  }
  return out;
}

class LocalStore {
  private data: StoreData;

  constructor() {
    this.data = this.load();
  }

  private emptyStore(): StoreData {
    const store = {} as StoreData;
    for (const model of MODEL_NAMES) {
      store[model] = [];
    }
    return store;
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Partial<StoreData>;
        const store = this.emptyStore();
        for (const model of MODEL_NAMES) {
          if (Array.isArray(raw[model])) {
            store[model] = raw[model]!.map(reviveRecord);
          }
        }
        return store;
      }
    } catch {
      // Fall back to empty store on corrupt file
    }
    return this.emptyStore();
  }

  public save(): void {
    try {
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf8");
    } catch {
      // Ignore write errors in read-only edge cases
    }
  }

  public getRows(model: ModelName): Record<string, any>[] {
    return this.data[model];
  }

  public setRows(model: ModelName, rows: Record<string, any>[]): void {
    this.data[model] = rows;
  }

  public matchesWhere(model: ModelName, row: Record<string, any>, where?: Record<string, any>): boolean {
    if (!where) return true;
    for (const [key, cond] of Object.entries(where)) {
      if (cond === undefined) continue;
      if (key === "OR" && Array.isArray(cond)) {
        if (!cond.some((sub) => this.matchesWhere(model, row, sub))) return false;
        continue;
      }
      if (key === "AND" && Array.isArray(cond)) {
        if (!cond.every((sub) => this.matchesWhere(model, row, sub))) return false;
        continue;
      }
      // Relation filter: quotation.where.lead
      if (model === "quotation" && key === "lead" && cond && typeof cond === "object") {
        const leadRow = this.data.lead.find((l) => l.id === row.leadId);
        if (!leadRow || !this.matchesWhere("lead", leadRow, cond)) return false;
        continue;
      }
      // Composite unique key support
      if (key === "platform_accountName" && cond && typeof cond === "object") {
        if (row.platform !== cond.platform || row.accountName !== cond.accountName) return false;
        continue;
      }

      const val = row[key];
      if (cond === null) {
        if (val !== null && val !== undefined) return false;
        continue;
      }
      if (cond instanceof Date) {
        const dVal = val instanceof Date ? val.getTime() : val ? new Date(val).getTime() : NaN;
        if (dVal !== cond.getTime()) return false;
        continue;
      }
      if (typeof cond === "object") {
        if ("in" in cond && Array.isArray(cond.in)) {
          if (!cond.in.includes(val)) return false;
        }
        if ("notIn" in cond && Array.isArray(cond.notIn)) {
          if (cond.notIn.includes(val)) return false;
        }
        if ("contains" in cond && typeof cond.contains === "string") {
          if (typeof val !== "string" || !val.toLowerCase().includes(cond.contains.toLowerCase())) return false;
        }
        if ("endsWith" in cond && typeof cond.endsWith === "string") {
          if (typeof val !== "string" || !val.endsWith(cond.endsWith)) return false;
        }
        if ("startsWith" in cond && typeof cond.startsWith === "string") {
          if (typeof val !== "string" || !val.startsWith(cond.startsWith)) return false;
        }
        if ("lte" in cond && cond.lte !== undefined) {
          if (val === null || val === undefined) return false;
          const vTime = val instanceof Date ? val.getTime() : typeof val === "string" && DATE_FIELDS.has(key) ? new Date(val).getTime() : val;
          const cTime = cond.lte instanceof Date ? cond.lte.getTime() : cond.lte;
          if (!(vTime <= cTime)) return false;
        }
        if ("lt" in cond && cond.lt !== undefined) {
          if (val === null || val === undefined) return false;
          const vTime = val instanceof Date ? val.getTime() : typeof val === "string" && DATE_FIELDS.has(key) ? new Date(val).getTime() : val;
          const cTime = cond.lt instanceof Date ? cond.lt.getTime() : cond.lt;
          if (!(vTime < cTime)) return false;
        }
        if ("gte" in cond && cond.gte !== undefined) {
          if (val === null || val === undefined) return false;
          const vTime = val instanceof Date ? val.getTime() : typeof val === "string" && DATE_FIELDS.has(key) ? new Date(val).getTime() : val;
          const cTime = cond.gte instanceof Date ? cond.gte.getTime() : cond.gte;
          if (!(vTime >= cTime)) return false;
        }
        if ("gt" in cond && cond.gt !== undefined) {
          if (val === null || val === undefined) return false;
          const vTime = val instanceof Date ? val.getTime() : typeof val === "string" && DATE_FIELDS.has(key) ? new Date(val).getTime() : val;
          const cTime = cond.gt instanceof Date ? cond.gt.getTime() : cond.gt;
          if (!(vTime > cTime)) return false;
        }
        continue;
      }
      if (val !== cond) return false;
    }
    return true;
  }

  public sortRows(rows: Record<string, any>[], orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>): Record<string, any>[] {
    if (!orderBy) return rows;
    const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...rows].sort((a, b) => {
      for (const spec of specs) {
        const [field, dir] = Object.entries(spec)[0] ?? [];
        if (!field) continue;
        const av = a[field];
        const bv = b[field];
        if (av === bv) continue;
        if (av === null || av === undefined) return dir === "asc" ? 1 : -1;
        if (bv === null || bv === undefined) return dir === "asc" ? -1 : 1;
        const aComp = av instanceof Date ? av.getTime() : av;
        const bComp = bv instanceof Date ? bv.getTime() : bv;
        if (aComp < bComp) return dir === "asc" ? -1 : 1;
        if (aComp > bComp) return dir === "asc" ? 1 : -1;
      }
      return 0;
    });
  }

  public attachRelations(model: ModelName, row: Record<string, any>, include?: Record<string, any>, select?: Record<string, any>): Record<string, any> {
    let result: Record<string, any> = reviveRecord(row);

    if (include) {
      if (include._count?.select) {
        const counts: Record<string, number> = {};
        for (const [relKey, enabled] of Object.entries(include._count.select)) {
          if (!enabled) continue;
          if (model === "lead" && relKey === "activities") {
            counts.activities = this.data.leadActivity.filter((a) => a.leadId === row.id).length;
          } else if (model === "lead" && relKey === "quotations") {
            counts.quotations = this.data.quotation.filter((q) => q.leadId === row.id).length;
          } else if (model === "familyProfile" && relKey === "referenceAssets") {
            counts.referenceAssets = this.data.familyReferenceAsset.filter((a) => a.profileId === row.id).length;
          }
        }
        result._count = counts;
      }

      if (model === "lead") {
        if (include.company) {
          const company = this.data.company.find((c) => c.id === row.companyId) ?? null;
          result.company = company && typeof include.company === "object" && include.company.select
            ? this.applySelect(company, include.company.select)
            : company;
        }
        if (include.activities) {
          let acts = this.data.leadActivity.filter((a) => a.leadId === row.id).map(reviveRecord);
          if (typeof include.activities === "object") {
            acts = this.sortRows(acts, include.activities.orderBy);
            if (typeof include.activities.take === "number") acts = acts.slice(0, include.activities.take);
          }
          result.activities = acts;
        }
        if (include.quotations) {
          let quotes = this.data.quotation.filter((q) => q.leadId === row.id).map((q) =>
            this.attachRelations("quotation", q, typeof include.quotations === "object" ? include.quotations.include : undefined)
          );
          if (typeof include.quotations === "object") {
            quotes = this.sortRows(quotes, include.quotations.orderBy);
            if (typeof include.quotations.take === "number") quotes = quotes.slice(0, include.quotations.take);
          }
          result.quotations = quotes;
        }
      }

      if (model === "quotation") {
        if (include.items) {
          let items = this.data.quotationItem.filter((item) => item.quotationId === row.id).map(reviveRecord);
          if (typeof include.items === "object") {
            items = this.sortRows(items, include.items.orderBy);
          }
          result.items = items;
        }
        if (include.lead) {
          const lead = this.data.lead.find((l) => l.id === row.leadId) ?? null;
          if (lead) {
            const leadWithCompany = this.attachRelations("lead", lead, { company: { select: { name: true, domain: true } } });
            result.lead = typeof include.lead === "object" && include.lead.select
              ? this.applySelect(leadWithCompany, include.lead.select)
              : leadWithCompany;
          } else {
            result.lead = null;
          }
        }
      }

      if (model === "familyProfile" && include.referenceAssets) {
        let assets = this.data.familyReferenceAsset.filter((a) => a.profileId === row.id).map(reviveRecord);
        if (typeof include.referenceAssets === "object") {
          assets = this.sortRows(assets, include.referenceAssets.orderBy);
        }
        result.referenceAssets = assets;
      }

      if (model === "familyProject" && include.profiles) {
        let profileIds: string[] = [];
        try {
          profileIds = JSON.parse(row.castProfileIds || "[]");
        } catch {}
        let profiles = this.data.familyProfile.filter((p) => profileIds.includes(p.id)).map(reviveRecord);
        if (typeof include.profiles === "object" && include.profiles.select) {
          profiles = profiles.map((p) => this.applySelect(p, include.profiles.select));
        }
        result.profiles = profiles;
      }
    }

    if (select) {
      result = this.applySelect(result, select);
    }

    return result;
  }

  private applySelect(row: Record<string, any>, select: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(select)) {
      if (!val) continue;
      if (typeof val === "object" && "select" in val && row[key] && typeof row[key] === "object") {
        out[key] = this.applySelect(row[key], val.select);
      } else {
        out[key] = row[key];
      }
    }
    return out;
  }
}

let singletonStore: LocalStore | undefined;
function getStore(): LocalStore {
  if (!singletonStore) {
    singletonStore = new LocalStore();
  }
  return singletonStore;
}

function createModelDelegate(model: ModelName) {
  return {
    async findMany(args?: { where?: Record<string, any>; orderBy?: any; take?: number; include?: Record<string, any>; select?: Record<string, any> }) {
      const store = getStore();
      let rows = store.getRows(model).filter((row) => store.matchesWhere(model, row, args?.where));
      rows = store.sortRows(rows, args?.orderBy);
      if (typeof args?.take === "number") rows = rows.slice(0, args.take);
      return rows.map((row) => store.attachRelations(model, row, args?.include, args?.select));
    },

    async findFirst(args?: { where?: Record<string, any>; orderBy?: any; include?: Record<string, any>; select?: Record<string, any> }) {
      const list = await this.findMany({ ...args, take: 1 });
      return list[0] ?? null;
    },

    async findUnique(args: { where: Record<string, any>; include?: Record<string, any>; select?: Record<string, any> }) {
      return this.findFirst(args);
    },

    async count(args?: { where?: Record<string, any> }) {
      const store = getStore();
      return store.getRows(model).filter((row) => store.matchesWhere(model, row, args?.where)).length;
    },

    async create(args: { data: Record<string, any>; include?: Record<string, any>; select?: Record<string, any> }) {
      const store = getStore();
      const rawData = { ...args.data };

      // Handle Prisma relation connect (e.g. company: { connect: { id } })
      if (model === "lead" && rawData.company?.connect?.id) {
        rawData.companyId = rawData.company.connect.id;
        delete rawData.company;
      }
      if (model === "familyProject" && rawData.profiles) {
        if (!rawData.castProfileIds && Array.isArray(rawData.profiles?.connect)) {
          rawData.castProfileIds = JSON.stringify(rawData.profiles.connect.map((p: { id: string }) => p.id));
        }
        delete rawData.profiles;
      }

      // Handle nested quotation items create
      let nestedItems: Array<Record<string, any>> | undefined;
      if (model === "quotation" && rawData.items?.create) {
        nestedItems = Array.isArray(rawData.items.create) ? rawData.items.create : [rawData.items.create];
        delete rawData.items;
      }

      const defaults = MODEL_DEFAULTS[model]();
      const now = new Date();
      const record: Record<string, any> = {
        id: rawData.id ?? `alo_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
        ...defaults,
        ...rawData,
      };
      if (UPDATED_AT_MODELS.has(model) && !rawData.updatedAt) {
        record.updatedAt = now;
      }
      const revived = reviveRecord(record);
      store.getRows(model).push(revived);

      if (model === "quotation" && nestedItems) {
        for (const item of nestedItems) {
          const itemRecord = reviveRecord({
            id: `alo_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
            ...MODEL_DEFAULTS.quotationItem(),
            ...item,
            quotationId: revived.id,
          });
          store.getRows("quotationItem").push(itemRecord);
        }
      }

      store.save();
      return store.attachRelations(model, revived, args.include, args.select);
    },

    async createMany(args: { data: Array<Record<string, any>> }) {
      let count = 0;
      for (const item of args.data) {
        await this.create({ data: item });
        count++;
      }
      return { count };
    },

    async update(args: { where: Record<string, any>; data: Record<string, any>; include?: Record<string, any>; select?: Record<string, any> }) {
      const store = getStore();
      const rows = store.getRows(model);
      const idx = rows.findIndex((row) => store.matchesWhere(model, row, args.where));
      if (idx === -1) throw new Error(`Record to update not found in ${model}`);
      const current = rows[idx];
      const next: Record<string, any> = { ...current };

      for (const [key, val] of Object.entries(args.data)) {
        if (val === undefined) continue;
        if (val && typeof val === "object" && !(val instanceof Date) && "increment" in val) {
          next[key] = Number(next[key] ?? 0) + Number(val.increment);
        } else {
          next[key] = val;
        }
      }
      if (UPDATED_AT_MODELS.has(model)) {
        next.updatedAt = new Date();
      }
      const revived = reviveRecord(next);
      rows[idx] = revived;
      store.save();
      return store.attachRelations(model, revived, args.include, args.select);
    },

    async updateMany(args: { where?: Record<string, any>; data: Record<string, any> }) {
      const store = getStore();
      const rows = store.getRows(model);
      let count = 0;
      for (let i = 0; i < rows.length; i++) {
        if (store.matchesWhere(model, rows[i], args.where)) {
          const next: Record<string, any> = { ...rows[i] };
          for (const [key, val] of Object.entries(args.data)) {
            if (val === undefined) continue;
            if (val && typeof val === "object" && !(val instanceof Date) && "increment" in val) {
              next[key] = Number(next[key] ?? 0) + Number(val.increment);
            } else {
              next[key] = val;
            }
          }
          if (UPDATED_AT_MODELS.has(model)) {
            next.updatedAt = new Date();
          }
          rows[i] = reviveRecord(next);
          count++;
        }
      }
      if (count > 0) store.save();
      return { count };
    },

    async upsert(args: { where: Record<string, any>; update: Record<string, any>; create: Record<string, any> }) {
      const existing = await this.findFirst({ where: args.where });
      if (existing) {
        return this.update({ where: { id: existing.id }, data: args.update });
      }
      return this.create({ data: args.create });
    },

    async delete(args: { where: Record<string, any> }) {
      const store = getStore();
      const rows = store.getRows(model);
      const idx = rows.findIndex((row) => store.matchesWhere(model, row, args.where));
      if (idx === -1) throw new Error(`Record to delete not found in ${model}`);
      const [removed] = rows.splice(idx, 1);

      // Cascade delete support
      if (model === "lead") {
        store.setRows("leadActivity", store.getRows("leadActivity").filter((a) => a.leadId !== removed.id));
        const quoteIds = new Set(store.getRows("quotation").filter((q) => q.leadId === removed.id).map((q) => q.id));
        store.setRows("quotationItem", store.getRows("quotationItem").filter((item) => !quoteIds.has(item.quotationId)));
        store.setRows("quotation", store.getRows("quotation").filter((q) => q.leadId !== removed.id));
      } else if (model === "quotation") {
        store.setRows("quotationItem", store.getRows("quotationItem").filter((item) => item.quotationId !== removed.id));
      } else if (model === "familyProfile") {
        store.setRows("familyReferenceAsset", store.getRows("familyReferenceAsset").filter((a) => a.profileId !== removed.id));
      }

      store.save();
      return removed;
    },

    async deleteMany(args?: { where?: Record<string, any> }) {
      const store = getStore();
      const rows = store.getRows(model);
      const remaining = rows.filter((row) => !store.matchesWhere(model, row, args?.where));
      const count = rows.length - remaining.length;
      store.setRows(model, remaining);
      if (count > 0) store.save();
      return { count };
    },
  };
}

export function createLocalPrismaFallback(): Record<string, any> {
  const client: Record<string, any> = {};
  for (const model of MODEL_NAMES) {
    client[model] = createModelDelegate(model);
  }
  client.$queryRaw = async () => [{ 1: 1 }];
  client.$transaction = async <T>(fnOrArray: ((tx: any) => Promise<T>) | Promise<any>[]) => {
    if (typeof fnOrArray === "function") {
      return fnOrArray(client);
    }
    return Promise.all(fnOrArray);
  };
  client.$connect = async () => {};
  client.$disconnect = async () => {};
  return client;
}
