export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "ALO Learning Journey API",
    version: "1.0.0",
    description: "First-party API for the admissions CRM plus local-only AI/media generation. AI generation calls only private Ollama/ComfyUI endpoints or a marked local fallback; it does not use paid AI APIs. Publishing and messaging are not implied.",
  },
  servers: [{ url: "/", description: "Same-origin application API" }],
  security: [{ AdminSession: [] }],
  tags: [
    { name: "Admissions CRM", description: "Company-scoped enquiry records and activity history." },
    { name: "Quotations", description: "Draft quotations, status tracking, and printable customer copies." },
    { name: "System", description: "Health, local inference status, and machine-readable API documentation." },
    { name: "Local AI", description: "Generation through private self-hosted models or explicitly reported local fallbacks; no paid AI provider routing." },
    { name: "Media", description: "Local speech, procedural instrumental audio, and FFmpeg-generated video files." },
  ],
  paths: {
    "/api/crm/leads": {
      get: {
        tags: ["Admissions CRM"],
        summary: "List enquiries in the active workspace",
        description: "Returns at most 250 records. Search accepts name, email, phone, course, or country. Use due=1 for follow-ups due today or earlier.",
        parameters: [
          { $ref: "#/components/parameters/WorkspaceId" },
          { name: "q", in: "query", schema: { type: "string", maxLength: 120 } },
          { name: "stage", in: "query", schema: { $ref: "#/components/schemas/LeadStage" } },
          { name: "due", in: "query", schema: { type: "string", enum: ["1"] }, description: "Return only follow-ups due now." },
        ],
        responses: {
          "200": { description: "Enquiries and counts", content: { "application/json": { schema: { $ref: "#/components/schemas/LeadList" } } } },
          "400": { description: "Invalid stage filter" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "503": { $ref: "#/components/responses/AuthNotConfigured" },
        },
      },
      post: {
        tags: ["Admissions CRM"],
        summary: "Create an enquiry",
        parameters: [{ $ref: "#/components/parameters/WorkspaceId" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LeadCreate" } } } },
        responses: {
          "201": { description: "Created enquiry", content: { "application/json": { schema: { type: "object", properties: { lead: { $ref: "#/components/schemas/Lead" } }, required: ["lead"] } } } },
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/crm/leads/{id}": {
      parameters: [
        { $ref: "#/components/parameters/WorkspaceId" },
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      get: {
        tags: ["Admissions CRM"],
        summary: "Read an enquiry and its recent activity",
        responses: { "200": { description: "Enquiry and recent activity", content: { "application/json": { schema: { type: "object", properties: { lead: { $ref: "#/components/schemas/LeadDetail" } }, required: ["lead"] } } } }, "404": { description: "Enquiry not found in the active workspace" } },
      },
      patch: {
        tags: ["Admissions CRM"],
        summary: "Update an enquiry or move it through the pipeline",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LeadUpdate" } } } },
        responses: { "200": { description: "Updated enquiry", content: { "application/json": { schema: { type: "object", properties: { lead: { $ref: "#/components/schemas/Lead" } }, required: ["lead"] } } } }, "400": { $ref: "#/components/responses/ValidationError" }, "404": { description: "Enquiry not found in the active workspace" } },
      },
      delete: {
        tags: ["Admissions CRM"],
        summary: "Delete an enquiry and its related activity and quotations",
        description: "Permanent delete; related quotations and activities are removed by database cascade. The audit log stores only the record ID, not contact data.",
        responses: { "204": { description: "Deleted" }, "404": { description: "Enquiry not found in the active workspace" } },
      },
    },
    "/api/crm/leads/{id}/activities": {
      post: {
        tags: ["Admissions CRM"],
        summary: "Log an internal interaction or note",
        description: "Logs an activity only. It does not send an email, call, or WhatsApp message.",
        parameters: [
          { $ref: "#/components/parameters/WorkspaceId" },
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ActivityCreate" } } } },
        responses: { "201": { description: "Activity recorded", content: { "application/json": { schema: { type: "object", properties: { activity: { $ref: "#/components/schemas/LeadActivity" } }, required: ["activity"] } } } }, "400": { $ref: "#/components/responses/ValidationError" }, "404": { description: "Enquiry not found in the active workspace" } },
      },
    },
    "/api/crm/quotes": {
      get: {
        tags: ["Quotations"],
        summary: "List up to 250 quotations in the active workspace",
        parameters: [
          { $ref: "#/components/parameters/WorkspaceId" },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/QuoteStatus" } },
        ],
        responses: { "200": { description: "Quotation list", content: { "application/json": { schema: { type: "object", properties: { quotes: { type: "array", items: { $ref: "#/components/schemas/Quotation" } } }, required: ["quotes"] } } } }, "400": { description: "Invalid quotation status filter" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
      post: {
        tags: ["Quotations"],
        summary: "Create a draft quotation",
        description: "Prices and totals are calculated server-side using integer minor currency units. Tax defaults to 0%; confirm the applicable treatment separately.",
        parameters: [{ $ref: "#/components/parameters/WorkspaceId" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/QuotationCreate" } } } },
        responses: { "201": { description: "Draft quotation created", content: { "application/json": { schema: { type: "object", properties: { quote: { $ref: "#/components/schemas/Quotation" } }, required: ["quote"] } } } }, "400": { $ref: "#/components/responses/ValidationError" }, "404": { description: "Enquiry not found in the active workspace" } },
      },
    },
    "/api/crm/quotes/{id}": {
      parameters: [
        { $ref: "#/components/parameters/WorkspaceId" },
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      patch: {
        tags: ["Quotations"],
        summary: "Advance a quotation status",
        description: "Allowed transitions: draft → sent; sent → accepted, declined, or expired. Status changes are records only; no message is sent.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { status: { $ref: "#/components/schemas/QuoteStatus" } }, required: ["status"] } } } },
        responses: { "200": { description: "Status updated", content: { "application/json": { schema: { type: "object", properties: { quote: { $ref: "#/components/schemas/Quotation" } }, required: ["quote"] } } } }, "404": { description: "Quotation not found in the active workspace" }, "409": { description: "Invalid status transition" } },
      },
      delete: {
        tags: ["Quotations"],
        summary: "Delete a draft or declined quotation",
        responses: { "204": { description: "Deleted" }, "404": { description: "Quotation not found in the active workspace" }, "409": { description: "Only draft or declined quotations can be deleted" } },
      },
    },
    "/api/ai/local-status": {
      get: {
        tags: ["Local AI"],
        summary: "Check private local model and media-engine readiness",
        description: "Probes the configured private Ollama and ComfyUI services and local speech/FFmpeg binaries, and reports the optional direct external providers (Groq/LLM7/OpenCode Zen/OpenRouter, plus owner gateways such as a self-hosted OmniRoute or custom OpenAI-compatible providers) status without exposing any API key. Local endpoints reject public hosts. This reports availability only; it does not validate output quality or model licensing.",
        responses: { "200": { description: "Local-only service status", content: { "application/json": { schema: { $ref: "#/components/schemas/LocalAIStatus" } } } }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
    },
    "/api/images/generate": {
      post: {
        tags: ["Local AI", "Media"],
        summary: "Generate a local illustration or explicit placeholder",
        description: "Uses a private ComfyUI checkpoint. If unavailable, returns a clearly marked branded SVG placeholder; it never calls a hosted image API.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ImageGenerateRequest" } } } },
        responses: { "200": { description: "Local image or placeholder", content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" }, provider: { type: "string" }, usedFallback: { type: "boolean" }, error: { type: ["string", "null"] } }, required: ["url", "provider", "usedFallback"] } } } }, "400": { description: "Invalid prompt" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
    },
    "/api/voice/generate": {
      post: {
        tags: ["Media"],
        summary: "Synthesize local spoken narration",
        description: "Uses a configured local Piper model or eSpeak. The result is spoken audio, not singing; no hosted voice API is used.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/VoiceGenerateRequest" } } } },
        responses: { "200": { description: "Generated WAV and authenticated media URL", content: { "application/json": { schema: { $ref: "#/components/schemas/VoiceGenerateResponse" } } } }, "400": { description: "Invalid text" }, "503": { description: "No usable local speech engine" } },
      },
    },
    "/api/music/generate": {
      post: {
        tags: ["Local AI", "Media"],
        summary: "Draft Bengali lyrics and generate a procedural instrumental",
        description: "Lyrics use local Ollama or an explicit template fallback. A built-in deterministic synthesizer creates an instrumental WAV; it does not sing vocals.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MusicGenerateRequest" } } } },
        responses: { "200": { description: "Lyrics plus authenticated local instrumental URL", content: { "application/json": { schema: { $ref: "#/components/schemas/MusicGenerateResponse" } } } }, "400": { description: "Invalid topic or duration" } },
      },
    },
    "/api/video/cinematic": {
      post: {
        tags: ["Local AI", "Media"],
        summary: "Render a local cinematic-style slideshow video",
        description: "Uses ComfyUI still images if available, otherwise branded placeholder artwork; FFmpeg adds Ken Burns motion, captions/SRT, local speech, and procedural music. This is not frame-by-frame generated video.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CinematicVideoRequest" } } } },
        responses: { "200": { description: "Rendered local MP4 and scene metadata" }, "400": { description: "Invalid input" }, "503": { description: "Local media dependencies are unavailable" } },
      },
    },
    "/api/video/generate": {
      post: {
        tags: ["Local AI", "Media"],
        summary: "Render a local text-led social video",
        description: "Uses local synthetic speech, FFmpeg motion graphics, and a procedural instrumental. It does not call a paid video or voice API.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CinematicVideoRequest" } } } },
        responses: { "200": { description: "Rendered local MP4" }, "400": { description: "Invalid input" }, "503": { description: "Local media dependencies are unavailable" } },
      },
    },
    "/api/media/video/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^(video|cine)_" } }],
      get: { tags: ["Media"], summary: "Stream a generated MP4", description: "Authenticated, private byte-range response for a local generated video.", responses: { "200": { description: "MP4 video", content: { "video/mp4": { schema: { type: "string", format: "binary" } } } }, "206": { description: "Partial MP4 byte range" }, "404": { description: "Video not found" } } },
    },
    "/api/media/audio/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^(song|voice)_" } }],
      get: { tags: ["Media"], summary: "Download or play generated WAV audio", responses: { "200": { description: "WAV audio", content: { "audio/wav": { schema: { type: "string", format: "binary" } } } }, "404": { description: "Audio not found" } } },
    },
    "/api/media/scene/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^cine_.*_scene[0-9]+\\.png$" } }],
      get: { tags: ["Media"], summary: "Read a generated local scene still", responses: { "200": { description: "PNG still", content: { "image/png": { schema: { type: "string", format: "binary" } } } }, "404": { description: "Scene image not found" } } },
    },
    "/api/media/subtitle/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^cine_" } }],
      get: { tags: ["Media"], summary: "Download cinematic video SRT captions", responses: { "200": { description: "SubRip captions", content: { "application/x-subrip": { schema: { type: "string" } } } }, "404": { description: "Subtitle file not found" } } },
    },
    "/api/diagrams": {
      get: {
        tags: ["Media", "System"],
        summary: "List 45 visual diagram types, 5 WCAG skins, and render an orthogonal Editorial SVG schematic",
        responses: { "200": { description: "Diagram SVG, WCAG contrast doctor, and 45-type catalog" } },
      },
      post: {
        tags: ["Media", "System"],
        summary: "Render an orthogonal Editorial SVG/HTML/PNG schematic or redraw Mermaid syntax",
        responses: { "200": { description: "Rendered SVG, self-contained HTML, or PNG binary" } },
      },
    },
    "/api/marketing/humanize": {
      post: {
        tags: ["Local AI"],
        summary: "Detect and rewrite structural AI writing patterns (Humanizer §1–§19) while preserving merge tags",
        responses: { "200": { description: "Humanized text, detected patterns, and before/after scores" } },
      },
    },
    "/api/openapi.json": {
      get: {
        tags: ["System"],
        summary: "Download this OpenAPI specification",
        security: [{ AdminSession: [] }],
        responses: { "200": { description: "OpenAPI 3.1 document", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Basic health status",
        description: "Public, low-detail readiness probe that reports only ok/unhealthy. Use details=1 for diagnostics; that response requires a signed-in administrator session in production.",
        security: [{ AdminSession: [] }, {}],
        parameters: [{ name: "details", in: "query", required: false, schema: { type: "string", enum: ["1"] }, description: "Return detailed dependency checks. Requires an administrator session in production." }],
        responses: { "200": { description: "Health response" }, "503": { description: "Database or core schema is unavailable" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
    },
  },
  components: {
    securitySchemes: {
      AdminSession: {
        type: "apiKey",
        in: "cookie",
        name: "next-auth.session-token",
        description: "Administrator session created by the Credentials sign-in. On HTTPS production the cookie uses the __Secure-next-auth.session-token name.",
      },
    },
    parameters: {
      WorkspaceId: {
        name: "x-alo-company-id",
        in: "header",
        required: false,
        schema: { type: "string" },
        description: "Active workspace ID. If omitted, the first active workspace is used.",
      },
    },
    responses: {
      Unauthorized: { description: "Sign-in is required" },
      AuthNotConfigured: { description: "Administrator authentication is not configured" },
      ValidationError: { description: "Invalid request body" },
    },
    schemas: {
      LocalAIStatus: {
        type: "object",
        properties: {
          mode: { type: "string", const: "local-only" },
          paidApiCalls: { type: "boolean", const: false },
          text: { type: "object", properties: { available: { type: "boolean" }, serviceAvailable: { type: "boolean" }, model: { type: "string" }, installedModels: { type: "array", items: { type: "string" } }, error: { type: ["string", "null"] } }, required: ["available", "serviceAvailable", "model", "installedModels"] },
          images: { type: "object", properties: { available: { type: "boolean" }, checkpoint: { type: ["string", "null"] }, error: { type: ["string", "null"] } }, required: ["available", "checkpoint"] },
          external: { type: "object", properties: { enabled: { type: "boolean" }, configured: { type: "boolean" }, order: { type: "array", items: { type: "string" } }, providers: { type: "array", items: { type: "object", properties: { provider: { type: "string" }, kind: { type: "string", enum: ["free-tier", "owner-gateway"] }, configured: { type: "boolean" }, model: { type: "string" }, reason: { type: "string", enum: ["ready", "disabled", "missing_api_key", "invalid_model", "non_free_model", "invalid_endpoint"] } }, required: ["provider", "kind", "configured", "model", "reason"] } }, dataPolicy: { type: "string", const: "non-personal-content-drafts-only" } }, required: ["enabled", "configured", "order", "providers", "dataPolicy"] },
          media: { type: "object" },
        },
        required: ["mode", "paidApiCalls", "text", "images", "media"],
      },
      ImageGenerateRequest: { type: "object", properties: { prompt: { type: "string", minLength: 1, maxLength: 2000 }, filename: { type: "string", maxLength: 80 } }, required: ["prompt"] },
      VoiceGenerateRequest: { type: "object", properties: { text: { type: "string", minLength: 1, maxLength: 5000 }, voice: { type: "string", maxLength: 24, default: "bn" } }, required: ["text"] },
      VoiceGenerateResponse: { type: "object", properties: { id: { type: "string" }, audioUrl: { type: "string" }, engine: { type: "string", enum: ["piper-local", "espeak-local", "builtin-formant"] }, durationSeconds: { type: "number" }, format: { type: "string", const: "wav" } }, required: ["id", "audioUrl", "engine", "durationSeconds", "format"] },
      MusicGenerateRequest: { type: "object", properties: { topic: { type: "string", minLength: 1, maxLength: 240 }, mood: { type: "string", enum: ["calm", "hopeful", "playful", "reflective"], default: "hopeful" }, durationSeconds: { type: "integer", minimum: 10, maximum: 90, default: 45 }, bpm: { type: "integer", minimum: 65, maximum: 130, default: 88 } }, required: ["topic"] },
      MusicGenerateResponse: { type: "object", properties: { id: { type: "string" }, audioUrl: { type: "string" }, lyrics: { type: "object", properties: { title: { type: "string" }, lyrics: { type: "string" }, styleNote: { type: "string" } }, required: ["title", "lyrics", "styleNote"] }, mood: { type: "string" }, bpm: { type: "integer" }, lyricsProvider: { type: "string" }, lyricsUsedFallback: { type: "boolean" }, instrumental: { type: "object" } }, required: ["id", "audioUrl", "lyrics", "mood", "bpm", "lyricsProvider", "lyricsUsedFallback", "instrumental"] },
      CinematicVideoRequest: { type: "object", properties: { topic: { type: "string", minLength: 1, maxLength: 240 }, text: { type: "string", maxLength: 8000 }, script: { type: "string", maxLength: 8000 }, transcript: { type: "string", maxLength: 8000 }, audience: { type: "string", maxLength: 160 }, duration: { type: "integer", minimum: 10, maximum: 600, default: 50 }, voice: { type: "string", maxLength: 24, default: "bn" }, visualStyle: { type: "string", maxLength: 100 }, visualPrompts: { type: "array", maxItems: 3, items: { type: "string", maxLength: 300 } }, mood: { type: "string", enum: ["calm", "hopeful", "playful", "reflective"] } }, required: ["topic"] },
      LeadStage: { type: "string", enum: ["new", "contacted", "qualified", "consultation_booked", "proposal_sent", "enrolled", "lost"] },
      QuoteStatus: { type: "string", enum: ["draft", "sent", "accepted", "declined", "expired"] },
      ConsentStatus: { type: "string", enum: ["unknown", "consented", "opted_out"] },
      Lead: {
        type: "object",
        properties: {
          id: { type: "string" }, companyId: { type: "string" }, fullName: { type: "string" }, email: { type: ["string", "null"], format: "email", maxLength: 191 }, phone: { type: ["string", "null"] },
          targetCountry: { type: ["string", "null"] }, studyLevel: { type: ["string", "null"] }, courseInterest: { type: ["string", "null"] }, intake: { type: ["string", "null"] },
          source: { type: "string", enum: ["website", "referral", "social", "event", "partner", "other"] }, stage: { $ref: "#/components/schemas/LeadStage" },
          consentStatus: { $ref: "#/components/schemas/ConsentStatus" }, consentRecordedAt: { type: ["string", "null"], format: "date-time" }, nextFollowUp: { type: ["string", "null"], format: "date-time" },
          notes: { type: ["string", "null"] }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
          _count: { type: "object", properties: { activities: { type: "integer" }, quotations: { type: "integer" } }, required: ["activities", "quotations"] },
        },
        required: ["id", "companyId", "fullName", "source", "stage", "consentStatus", "createdAt", "updatedAt"],
      },
      LeadCreate: {
        type: "object",
        properties: {
          fullName: { type: "string", minLength: 2, maxLength: 120 }, email: { type: ["string", "null"], format: "email", maxLength: 191 }, phone: { type: ["string", "null"], maxLength: 40 },
          targetCountry: { type: ["string", "null"], maxLength: 100 }, studyLevel: { type: ["string", "null"], maxLength: 100 }, courseInterest: { type: ["string", "null"], maxLength: 160 }, intake: { type: ["string", "null"], maxLength: 80 },
          source: { type: "string", enum: ["website", "referral", "social", "event", "partner", "other"], default: "website" }, stage: { $ref: "#/components/schemas/LeadStage" },
          consentStatus: { $ref: "#/components/schemas/ConsentStatus" }, consentRecordedAt: { type: ["string", "null"], description: "Date-only (YYYY-MM-DD) or ISO-8601 date-time." }, nextFollowUp: { type: ["string", "null"], description: "Date-only (YYYY-MM-DD) or ISO-8601 date-time." }, notes: { type: ["string", "null"], maxLength: 5000 },
        },
        required: ["fullName"],
        anyOf: [
          { required: ["email"], properties: { email: { type: "string", format: "email" } } },
          { required: ["phone"], properties: { phone: { type: "string", minLength: 7 } } },
        ],
        description: "At least one of email or phone is required. Marking consented requires a consent capture date.",
      },
      LeadUpdate: {
        type: "object",
        minProperties: 1,
        description: "One or more editable enquiry fields. At least one email address or phone number must remain on the record; if consentStatus is consented, include its capture date.",
        properties: {
          fullName: { type: "string", minLength: 2, maxLength: 120 }, email: { type: ["string", "null"], format: "email", maxLength: 191 }, phone: { type: ["string", "null"], maxLength: 40 },
          targetCountry: { type: ["string", "null"], maxLength: 100 }, studyLevel: { type: ["string", "null"], maxLength: 100 }, courseInterest: { type: ["string", "null"], maxLength: 160 }, intake: { type: ["string", "null"], maxLength: 80 },
          source: { type: "string", enum: ["website", "referral", "social", "event", "partner", "other"] }, stage: { $ref: "#/components/schemas/LeadStage" },
          consentStatus: { $ref: "#/components/schemas/ConsentStatus" }, consentRecordedAt: { type: ["string", "null"], description: "Date-only (YYYY-MM-DD) or ISO-8601 date-time." }, nextFollowUp: { type: ["string", "null"], description: "Date-only (YYYY-MM-DD) or ISO-8601 date-time." }, notes: { type: ["string", "null"], maxLength: 5000 },
        },
      },
      ActivityCreate: { type: "object", properties: { type: { type: "string", enum: ["note", "call", "email", "whatsapp", "meeting", "follow_up"], default: "note" }, body: { type: "string", minLength: 1, maxLength: 5000 } }, required: ["body"] },
      QuotationItemCreate: { type: "object", properties: { description: { type: "string", minLength: 2, maxLength: 180 }, quantity: { type: "integer", minimum: 1, maximum: 1000 }, unitPrice: { type: "number", minimum: 0, maximum: 10000000, multipleOf: 0.01 } }, required: ["description", "quantity", "unitPrice"] },
      QuotationCreate: {
        type: "object",
        properties: {
          leadId: { type: "string" }, title: { type: "string", minLength: 2, maxLength: 160 }, currency: { type: "string", enum: ["GBP", "USD", "EUR", "BDT"], default: "GBP" },
          validUntil: { type: ["string", "null"], description: "Date-only (YYYY-MM-DD) or ISO-8601 date-time." }, discountAmount: { type: "number", minimum: 0, maximum: 10000000, multipleOf: 0.01, default: 0 }, taxRate: { type: "number", minimum: 0, maximum: 100, multipleOf: 0.01, default: 0 },
          terms: { type: ["string", "null"], maxLength: 3000 }, notes: { type: ["string", "null"], maxLength: 3000 }, items: { type: "array", minItems: 1, maxItems: 25, items: { $ref: "#/components/schemas/QuotationItemCreate" } },
        },
        required: ["leadId", "title", "items"],
      },
      LeadList: {
        type: "object",
        properties: {
          leads: { type: "array", items: { $ref: "#/components/schemas/Lead" } },
          stats: {
            type: "object",
            properties: { total: { type: "integer" }, new: { type: "integer" }, followUpsDue: { type: "integer" }, openQuotations: { type: "integer" } },
            required: ["total", "new", "followUpsDue", "openQuotations"],
          },
        },
        required: ["leads", "stats"],
      },
      CompanySummary: {
        type: "object",
        properties: { name: { type: "string" }, domain: { type: ["string", "null"] } },
        required: ["name", "domain"],
      },
      LeadActivity: {
        type: "object",
        properties: {
          id: { type: "string" }, leadId: { type: "string" }, type: { type: "string" }, body: { type: "string" },
          actor: { type: "string" }, createdAt: { type: "string", format: "date-time" },
        },
        required: ["id", "leadId", "type", "body", "actor", "createdAt"],
      },
      LeadDetail: {
        allOf: [
          { $ref: "#/components/schemas/Lead" },
          {
            type: "object",
            properties: {
              company: { $ref: "#/components/schemas/CompanySummary" },
              activities: { type: "array", maxItems: 50, items: { $ref: "#/components/schemas/LeadActivity" } },
              quotations: { type: "array", items: { $ref: "#/components/schemas/Quotation" } },
            },
            required: ["company", "activities", "quotations"],
          },
        ],
      },
      QuotationItem: {
        type: "object",
        properties: {
          id: { type: "string" }, quotationId: { type: "string" }, description: { type: "string" },
          quantity: { type: "integer" }, unitPrice: { type: "string", pattern: "^\\d{1,10}\\.\\d{2}$", description: "Prisma Decimal serialised as a fixed two-decimal string." },
          lineTotal: { type: "string", pattern: "^\\d{1,10}\\.\\d{2}$" }, position: { type: "integer" },
        },
        required: ["id", "quotationId", "description", "quantity", "unitPrice", "lineTotal", "position"],
      },
      Quotation: {
        type: "object",
        properties: {
          id: { type: "string" }, leadId: { type: "string" }, number: { type: "string" }, title: { type: "string" },
          currency: { type: "string", enum: ["GBP", "USD", "EUR", "BDT"] }, status: { $ref: "#/components/schemas/QuoteStatus" },
          subtotal: { type: "string", description: "Prisma Decimal serialized as a fixed two-decimal string." },
          discountAmount: { type: "string" }, taxRate: { type: "string" }, taxAmount: { type: "string" }, total: { type: "string" },
          validUntil: { type: ["string", "null"], format: "date-time" }, terms: { type: ["string", "null"] }, notes: { type: ["string", "null"] },
          acceptedAt: { type: ["string", "null"], format: "date-time" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
          items: { type: "array", items: { $ref: "#/components/schemas/QuotationItem" } },
          lead: { type: "object", properties: { id: { type: "string" }, fullName: { type: "string" }, email: { type: ["string", "null"], format: "email", maxLength: 191 }, phone: { type: ["string", "null"] }, company: { $ref: "#/components/schemas/CompanySummary" } }, required: ["id", "fullName", "email", "phone", "company"] },
        },
        required: ["id", "leadId", "number", "title", "currency", "status", "subtotal", "discountAmount", "taxRate", "taxAmount", "total", "validUntil", "terms", "notes", "acceptedAt", "createdAt", "updatedAt", "items"],
      },
    },
  },
} as const;
