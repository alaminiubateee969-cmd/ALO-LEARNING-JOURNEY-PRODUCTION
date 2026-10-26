export interface MarketingAssetTemplate {
  id: string;
  channel: "Email" | "WhatsApp" | "Social post" | "Carousel" | "Landing page" | "SMS";
  title: string;
  body: string;
  /** A/B subject or hook variants (knsoftic/Email_Markting DecideAbTests pattern) — human picks, never auto-sent. */
  abVariants?: string[];
  /** Drip offset in days from the kit trigger (RunAutomations/DispatchScheduledCampaigns pattern). */
  sequenceDay?: number;
}

/** Timed drip step: automation trigger → scheduled draft (planning metadata only — ALO never sends). */
export interface MarketingCadenceStep {
  day: number;
  channel: "Email" | "WhatsApp" | "SMS";
  angle: string;
  note: string;
}

export interface MarketingKit {
  id: string;
  title: string;
  category:
    | "Enquiry follow-up"
    | "Awareness"
    | "Event"
    | "Readiness"
    | "Country pathway"
    | "Lead magnet"
    | "Growth & CRO"
    | "Lifecycle & Retention";
  objective: string;
  audience: string;
  angle: string;
  topic: string;
  sourceInspiration?: string;
  fields: Array<{ key: string; label: string; defaultValue: string }>;
  guardrails: string[];
  assets: MarketingAssetTemplate[];
  /** Automation trigger, e.g. "lead_magnet_downloaded" — planning metadata from the Email_Markting automation model. */
  trigger?: string;
  /** Local send window guidance (Tuesday–Thursday, 9–11 AM or 1–3 PM recipient-local). */
  sendWindow?: string;
  /** Timed touch cadence with angle rotation (marketingskills cold-email follow-up research). */
  cadence?: MarketingCadenceStep[];
}

export interface MarketingSkillItem {
  slug: string;
  title: string;
  group: "Strategy & Planning" | "Copy & Content" | "Conversion & Offers" | "Acquisition & SEO" | "Lifecycle & Retention" | "Ops & Intelligence";
  summary: string;
  aloApplication: string;
  deliverable: string;
}

/**
 * 16 Multi-Channel Marketing Kits for ALO Education & Learning Journey.
 * Placeholders must be human-verified before use; copying or planning never sends messages automatically.
 */
export const MARKETING_KITS: MarketingKit[] = [
  {
    id: "consultation-follow-up",
    title: "Study plan consultation",
    category: "Enquiry follow-up",
    objective: "Help a prospective student choose a useful next step after asking for information.",
    audience: "Students who explicitly requested information or a consultation.",
    angle: "A short, practical conversation about course fit, timing, and the application process.",
    topic: "Study plan consultation",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "course", label: "Course / subject", defaultValue: "your course options" },
      { key: "intake", label: "Intake", defaultValue: "your preferred intake" },
      { key: "booking_link", label: "Booking link", defaultValue: "[add verified booking link]" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Education team" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Use only for the enquiry response or a channel the recipient has agreed to receive.",
      "Do not imply that admission, funding, or a visa is guaranteed.",
      "Confirm the appointment URL and the organisation's privacy / preference links before publishing.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Helpful next step",
        body: "Subject: A next step for {{course}}\n\nHi {{first_name}},\n\nThanks for getting in touch. If useful, we can talk through your interest in {{course}}, your preferred timing ({{intake}}), and the questions to confirm with each institution.\n\nChoose a time here: {{booking_link}}\n\nThere is no pressure to book. Admission decisions are made by institutions, and we cannot guarantee an outcome.\n\nKind regards,\n{{advisor}}\n\nTo change your marketing preferences, use: {{preference_link}}",
      },
      {
        id: "whatsapp",
        channel: "WhatsApp",
        title: "Short enquiry reply",
        body: "Hi {{first_name}} — thanks for asking about {{course}}. If you share the intake you are considering ({{intake}}), we can outline a few questions to check with institutions. If a call helps, choose a time here: {{booking_link}}. No admission or visa outcome can be guaranteed. Reply STOP if you do not want further messages.",
      },
      {
        id: "social",
        channel: "Social post",
        title: "Plan with better questions",
        body: "Thinking about studying abroad? Start with three useful questions: what do you want to study, when would you like to begin, and what should you verify directly with the institution? Save this checklist and speak with a qualified adviser if you need help comparing next steps. No outcome is guaranteed.",
      },
    ],
  },
  {
    id: "application-readiness",
    title: "Application readiness checklist",
    category: "Readiness",
    objective: "Offer a simple, non-legal checklist that helps a student organise an application conversation.",
    audience: "Prospective applicants who have opted in to receive education updates.",
    angle: "Make the next conversation more useful by gathering questions, not sensitive documents.",
    topic: "Application readiness checklist",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "course", label: "Course / subject", defaultValue: "your chosen course" },
      { key: "institution", label: "Institution", defaultValue: "your shortlisted institution" },
      { key: "official_link", label: "Official information link", defaultValue: "[add current official link]" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Education team" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Verify current entry requirements, fees, and dates on the institution's own website before sharing.",
      "Never request passport scans or sensitive records through this marketing template.",
      "Immigration information is general only; refer people to official sources or an appropriately authorised adviser.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Prepare for your application conversation",
        body: "Subject: A quick checklist for {{course}}\n\nHi {{first_name}},\n\nBefore you compare options at {{institution}}, it can help to note: your academic background, preferred start date, questions about entry requirements, and the costs you need to verify.\n\nCheck current requirements directly with the institution: {{official_link}}\n\nThis checklist is general information, not admissions or immigration advice. Please do not send identity documents by reply.\n\n{{advisor}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "carousel",
        channel: "Carousel",
        title: "Five questions to verify",
        body: "Card 1 — Before you apply, pause and verify.\nCard 2 — Does the institution offer the course and intake you want?\nCard 3 — What are the published entry requirements?\nCard 4 — Which fees and deadlines are current on the official page?\nCard 5 — Who can answer course-specific questions?\nCard 6 — Save the official links. General information only; no admission or visa result is guaranteed.",
      },
      {
        id: "whatsapp",
        channel: "WhatsApp",
        title: "Checklist nudge",
        body: "Hi {{first_name}} — for {{course}}, start by checking the current entry criteria and dates with the institution: {{official_link}}. This is a general checklist, not legal or immigration advice. Please don't send passport or sensitive documents by chat.",
      },
    ],
  },
  {
    id: "student-family-session",
    title: "Student & family Q&A session",
    category: "Event",
    objective: "Invite interested students and families to an informational session with clear limits and logistics.",
    audience: "Students and families who opted in to event announcements.",
    angle: "A calm space to ask about planning, course research, and where to verify official information.",
    topic: "Student and family information session",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "event_date", label: "Event date", defaultValue: "[confirm date]" },
      { key: "event_time", label: "Event time and timezone", defaultValue: "[confirm time and timezone]" },
      { key: "registration_link", label: "Registration link", defaultValue: "[add verified registration link]" },
      { key: "host", label: "Host name", defaultValue: "ALO Education team" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Confirm date, time zone, accessibility details, host, and registration link before sending.",
      "State clearly that a session is informational and does not promise admission, funding, or a visa.",
      "Use event reminders only where the recipient has opted in or another lawful basis has been reviewed.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Invitation",
        body: "Subject: Questions about your study plans? Join our Q&A\n\nHi {{first_name}},\n\nYou are invited to an online information session on {{event_date}} at {{event_time}}. Bring your questions about comparing courses, planning a timeline, and finding official information.\n\nRegister here: {{registration_link}}\n\nThe session is informational. It cannot guarantee admission, scholarships, or immigration outcomes.\n\nBest,\n{{host}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "social",
        channel: "Social post",
        title: "Event announcement",
        body: "STUDY PLANNING Q&A\n{{event_date}} · {{event_time}}\n\nBring your questions about course research, application planning, and where to verify requirements. Informational session only—no admission or visa outcomes are promised.\n\nRegister: {{registration_link}}",
      },
      {
        id: "whatsapp",
        channel: "WhatsApp",
        title: "Opt-in event reminder",
        body: "Reminder for the study-planning Q&A on {{event_date}} at {{event_time}}: {{registration_link}}. The session is informational and does not guarantee any outcome. Reply STOP to opt out of further event messages.",
      },
    ],
  },
  {
    id: "deadline-awareness",
    title: "Application deadline awareness",
    category: "Awareness",
    objective: "Encourage students to check a published institution deadline without inventing urgency.",
    audience: "Prospective students following a course or institution who have requested relevant updates.",
    angle: "Remind people to verify the date at the official source and allow time for questions.",
    topic: "Verify course application dates",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "course", label: "Course / subject", defaultValue: "the course you are considering" },
      { key: "institution", label: "Institution", defaultValue: "the institution" },
      { key: "deadline", label: "Verified deadline", defaultValue: "[verify current date]" },
      { key: "official_link", label: "Official source URL", defaultValue: "[add current official link]" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Education team" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "A human must verify the date and URL on the official institution page immediately before use.",
      "Do not use countdowns, scarcity, or claims that an application is guaranteed to be accepted.",
      "Do not message opted-out contacts; keep an auditable source for contact preferences.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Check the official date",
        body: "Subject: Please verify the {{course}} application date\n\nHi {{first_name}},\n\nIf {{course}} at {{institution}} is on your shortlist, check the current deadline directly with the institution. Our notes show {{deadline}}, but dates can change—use the official page as the source of truth: {{official_link}}\n\nIf you need help understanding the published steps, reply with your question. This message is not a promise of an offer or outcome.\n\n{{advisor}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "social",
        channel: "Social post",
        title: "Deadline check",
        body: "Planning an application? Don't rely on an old screenshot or forwarded date. Open the institution's current course page and verify the deadline, entry criteria, and required steps. Save the official source so you can check it again. Dates change; an application never guarantees an offer.",
      },
      {
        id: "carousel",
        channel: "Carousel",
        title: "How to check an application date",
        body: "Card 1 — Application date check\nCard 2 — Open the institution's official course page.\nCard 3 — Confirm your specific course and intake.\nCard 4 — Check whether the date differs by applicant type.\nCard 5 — Save the page and note when you checked it.\nCard 6 — Ask the institution if anything is unclear. Dates can change; verify before acting.",
      },
    ],
  },
  {
    id: "uk-study-pathway",
    title: "UK Study & CAS Readiness Pathway",
    category: "Country pathway",
    objective: "Guide prospective UK applicants through course selection, CAS prerequisites, and official GOV.UK verification.",
    audience: "Students who inquired about UK undergraduate or postgraduate study.",
    angle: "Clear, factual preparation covering academic fit, English language evidence, and official UKVI rules.",
    topic: "UK higher education & CAS planning",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "course", label: "Course / programme", defaultValue: "MSc Data Science" },
      { key: "intake", label: "Intake window", defaultValue: "September 2027" },
      { key: "gov_uk_link", label: "Official GOV.UK Student visa URL", defaultValue: "https://www.gov.uk/student-visa" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO UK Admissions Desk" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Always link directly to GOV.UK for current financial maintenance and visa rules.",
      "Clarify that CAS issuance is at the sole discretion of the licensed sponsor university.",
      "Do not give regulated immigration advice unless authorised by the OISC/IAA.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "UK application & CAS milestone planner",
        body: "Subject: Planning your UK application for {{course}} ({{intake}})\n\nHi {{first_name}},\n\nTo prepare a clean application for {{course}} in the {{intake}} intake, we recommend reviewing four milestones in order:\n\n1. Academic & English requirement check on the university's course page.\n2. Offer review and deposit deadline verification.\n3. Pre-CAS interview and financial document preparation.\n4. Official Student visa rules on GOV.UK: {{gov_uk_link}}\n\nReply with your preferred universities if you would like a course-comparison sheet. University offers and CAS decisions rest with the institution.\n\nWarm regards,\n{{advisor}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "carousel",
        channel: "Carousel",
        title: "UK Study Timeline (6 Cards)",
        body: "Card 1 — UK Study Planning: 5 Stages to Verify\nCard 2 — Stage 1 (8–10 months out): Shortlist 3–5 courses and check entry & IELTS/PTE criteria.\nCard 3 — Stage 2 (6–8 months out): Submit academic transcripts, SOP, and reference letters.\nCard 4 — Stage 3 (4–5 months out): Review conditional/unconditional offer terms.\nCard 5 — Stage 4 (3–4 months out): Complete pre-CAS checks and verify 28-day maintenance funds on GOV.UK.\nCard 6 — Stage 5: Check official Student visa guidance at gov.uk/student-visa. Informational only.",
      },
      {
        id: "whatsapp",
        channel: "WhatsApp",
        title: "UK CAS checklist note",
        body: "Hi {{first_name}} — for your {{intake}} UK plan ({{course}}), remember to verify current financial maintenance figures directly on {{gov_uk_link}} before preparing bank statements. Let us know if you want the university comparison sheet. Reply STOP to opt out.",
      },
    ],
  },
  {
    id: "canada-sds-pathway",
    title: "Canada Study Permit & PAL Checklist",
    category: "Country pathway",
    objective: "Help Canada-bound students track Provincial Attestation Letter (PAL), GIC, and IRCC requirements.",
    audience: "Students who opted in to Canada admissions and study-planning updates.",
    angle: "Structured verification of DLI status, PAL rules, and official IRCC documentation.",
    topic: "Canada study planning & PAL verification",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "province", label: "Target province", defaultValue: "Ontario" },
      { key: "intake", label: "Target intake", defaultValue: "Fall 2027" },
      { key: "ircc_link", label: "Official IRCC URL", defaultValue: "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Canada Desk" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Verify Designated Learning Institution (DLI) and PGWP eligibility on canada.ca before sharing.",
      "Confirm whether a Provincial Attestation Letter (PAL) applies to the specific study level.",
      "Do not guarantee study permit approval or post-graduation work eligibility.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Canada DLI & PAL verification steps",
        body: "Subject: Key checks for your {{intake}} study plan in {{province}}\n\nHi {{first_name}},\n\nWhen comparing Canadian institutions in {{province}} for {{intake}}, verify these items on the official IRCC portal ({{ircc_link}}):\n\n- Confirm the institution's DLI number and whether your specific programme is PGWP-eligible.\n- Check whether your study level requires a Provincial Attestation Letter (PAL).\n- Verify current proof-of-funds thresholds on canada.ca.\n\nLet us know if you would like to review your programme shortlist together. Permit decisions are made solely by IRCC.\n\nBest regards,\n{{advisor}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "social",
        channel: "Social post",
        title: "3 checks before applying to a Canadian college or university",
        body: "Planning to study in Canada? Check three things on canada.ca before you pay an application fee:\n1. Is the institution a Designated Learning Institution (DLI)?\n2. Does the specific programme qualify for PGWP under current rules?\n3. What are the current PAL and financial support requirements?\nAlways verify on official IRCC pages.",
      },
    ],
  },
  {
    id: "usa-f1-graduate",
    title: "USA University Shortlist & I-20 Timeline",
    category: "Country pathway",
    objective: "Organise US undergraduate/graduate shortlisting, standardized test planning, and I-20 timeline milestones.",
    audience: "Students researching US universities for Fall or Spring intakes.",
    angle: "Balanced shortlist construction (reach, target, safety) with transparent funding and deadline tracking.",
    topic: "USA university shortlist & I-20 preparation",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "degree", label: "Degree level & major", defaultValue: "MS Computer Science" },
      { key: "intake", label: "Target intake", defaultValue: "Fall 2027" },
      { key: "educationusa_link", label: "Official EducationUSA / Study in the States URL", defaultValue: "https://studyinthestates.dhs.gov/" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO USA Admissions Desk" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Verify GRE/GMAT waivers and departmental deadlines directly on each university department page.",
      "Do not promise graduate assistantships (RA/TA) or F-1 visa issuance.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Structuring your US university shortlist",
        body: "Subject: Building your {{intake}} shortlist for {{degree}}\n\nHi {{first_name}},\n\nFor {{degree}} ({{intake}}), a balanced shortlist typically groups universities into ambitious, target, and practical tiers based on published class profiles, tuition, and research fit.\n\nOfficial SEVIS and I-20 process overview: {{educationusa_link}}\n\nReply with 3 universities you are considering and we can help check their current departmental deadlines. Admission and funding decisions rest with each university.\n\nBest,\n{{advisor}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "landing",
        channel: "Landing page",
        title: "US Graduate Application Readiness Section",
        body: "Headline: Plan your {{degree}} application with verified departmental dates\nSubheadline: Compare curriculum, published tuition, and prerequisite coursework across accredited US universities.\nChecklist:\n- Departmental deadline vs priority funding deadline\n- Official transcript & credential evaluation rules (WES/ECE if required)\n- Statement of Purpose & faculty research alignment\n- Official I-20 & SEVIS fee overview ({{educationusa_link}})",
      },
    ],
  },
  {
    id: "australia-gsw-kit",
    title: "Australia CoE & Genuine Student (GS) Readiness",
    category: "Country pathway",
    objective: "Help applicants prepare structured responses for Australia's Genuine Student (GS) criteria and CoE steps.",
    audience: "Students exploring Australian universities and CRICOS-registered courses.",
    angle: "Evidence-backed study rationale, career alignment, and CRICOS verification.",
    topic: "Australia CRICOS & Genuine Student preparation",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "course", label: "CRICOS course name", defaultValue: "Master of Information Technology" },
      { key: "homeaffairs_link", label: "Official Home Affairs Subclass 500 URL", defaultValue: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Australia Desk" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Confirm the CRICOS code on the official Australian Government CRICOS register.",
      "Ensure the student writes their own authentic Genuine Student (GS) answers supported by real evidence.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Preparing for Australia's Genuine Student (GS) questions",
        body: "Subject: Preparing your Genuine Student (GS) notes for {{course}}\n\nHi {{first_name}},\n\nWhen applying for {{course}} in Australia, universities and the Department of Home Affairs review specific Genuine Student (GS) questions covering your current circumstances, why you chose the institution, and how the course fits your career plan.\n\nReview the official Subclass 500 requirements here: {{homeaffairs_link}}\n\nWe can review your draft notes so your supporting documents match every claim. Visa outcomes are decided by Home Affairs.\n\nRegards,\n{{advisor}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "whatsapp",
        channel: "WhatsApp",
        title: "CRICOS & GS reminder",
        body: "Hi {{first_name}} — before finalising your {{course}} shortlist for Australia, check the official Subclass 500 requirements on {{homeaffairs_link}} and keep supporting documents ready for each Genuine Student question. Reply STOP to opt out.",
      },
    ],
  },
  {
    id: "germany-aps-blocked-account",
    title: "Germany Public University, APS & Blocked Account Guide",
    category: "Country pathway",
    objective: "Explain the sequence of APS certification, uni-assist / direct applications, and Sperrkonto (Blocked Account) setup.",
    audience: "Students planning English- or German-taught degrees in Germany.",
    angle: "Early document authentication (APS) and ECTS credit matching prevent missed semester windows.",
    topic: "Germany APS & Sperrkonto planning",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "program", label: "Target programme", defaultValue: "MSc Automotive Engineering" },
      { key: "daad_link", label: "Official DAAD / Make it in Germany URL", defaultValue: "https://www.daad.de/en/" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Europe Desk" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Verify whether APS certification is required for the applicant's country of degree issuance.",
      "Check the current annual Blocked Account (Sperrkonto) amount on the German mission website.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Germany application & APS sequence",
        body: "Subject: Sequencing APS and uni-assist for {{program}}\n\nHi {{first_name}},\n\nGerman university admissions for {{program}} often depend on strict subject-credit (ECTS) matching and document verification.\n\n1. Check your programme requirements on DAAD: {{daad_link}}\n2. Confirm whether your academic records require APS or uni-assist VPD evaluation ahead of the deadline.\n3. Verify the current annual Blocked Account (Sperrkonto) requirement with the German embassy.\n\nReply if you want to check your credit breakdown against programme modules.\n\nBest,\n{{advisor}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "carousel",
        channel: "Carousel",
        title: "Germany Study Roadmap (5 Steps)",
        body: "Card 1 — Studying in Germany: Order of Operations\nCard 2 — Step 1: Filter programmes on DAAD.de and check ECTS subject prerequisites.\nCard 3 — Step 2: Start APS / uni-assist VPD verification early.\nCard 4 — Step 3: Verify language certificates (IELTS / TestDaF / Goethe).\nCard 5 — Step 4: Check official Blocked Account (Sperrkonto) figures on the German embassy site.",
      },
    ],
  },
  {
    id: "ielts-language-prep",
    title: "IELTS & Academic English Diagnostic Kit",
    category: "Readiness",
    objective: "Help applicants benchmark their current English score against university band requirements.",
    audience: "Students preparing for IELTS Academic, TOEFL iBT, or PTE Academic.",
    angle: "Focus on sub-score minimums (Writing & Speaking) rather than just overall band scores.",
    topic: "IELTS sub-score readiness & study plan",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "target_band", label: "Required band score", defaultValue: "6.5 overall (no band below 6.0)" },
      { key: "booking_link", label: "Diagnostic session link", defaultValue: "[add verified booking link]" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Language Prep Team" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Confirm whether the target university accepts IELTS One Skill Retake, PTE, or TOEFL.",
      "Do not guarantee a specific test score improvement within a fixed number of days.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Checking your sub-score requirements",
        body: "Subject: Preparing for {{target_band}}\n\nHi {{first_name}},\n\nMany university offers specify a minimum in each skill—such as {{target_band}}—where Writing or Speaking is often the bottleneck.\n\nIf you want a realistic study plan, book a short diagnostic review here: {{booking_link}}\n\nWe will check your target course's official accepted tests first so you prepare for the right exam format.\n\nBest regards,\n{{advisor}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "social",
        channel: "Social post",
        title: "Why overall IELTS band isn't the only number to check",
        body: "An overall 6.5 or 7.0 is only half the requirement—always check the minimum sub-score for Writing, Reading, Listening, and Speaking on your university's official course page before booking your test date.",
      },
    ],
  },
  {
    id: "scholarship-fee-planner",
    title: "Scholarship & Tuition Cost Comparison Kit",
    category: "Readiness",
    objective: "Give families a transparent worksheet to compare tuition, merit scholarships, and living costs.",
    audience: "Students and parents comparing total cost of attendance across shortlisted universities.",
    angle: "Compare net annual cost and verified scholarship criteria rather than headline award amounts.",
    topic: "Total cost of attendance & scholarship verification",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "institution", label: "Shortlisted university", defaultValue: "your shortlisted university" },
      { key: "scholarship_page", label: "Official scholarship URL", defaultValue: "[add official university scholarship URL]" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Admissions & Finance Desk" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Verify whether a scholarship is automatic or requires a separate essay/application before the deadline.",
      "State clearly whether awards apply to Year 1 only or renew across multiple years.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Comparing net tuition and official scholarships",
        body: "Subject: Tuition & scholarship worksheet for {{institution}}\n\nHi {{first_name}},\n\nWhen budgeting for {{institution}}, we recommend checking three figures on the official fee page ({{scholarship_page}}):\n\n1. Published international tuition for your specific programme.\n2. Whether merit bursaries are automatic or require a separate deadline.\n3. Whether the award is a one-time Year 1 deduction or renewable.\n\nReply if you would like our side-by-side BDT/foreign-currency budget worksheet. Scholarships are awarded by the institution and are never guaranteed.\n\nRegards,\n{{advisor}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "whatsapp",
        channel: "WhatsApp",
        title: "Scholarship deadline check",
        body: "Hi {{first_name}} — scholarship deadlines at {{institution}} often close earlier than general admissions. Check the official terms here: {{scholarship_page}}. Let us know if you need the cost-comparison sheet. Reply STOP to opt out.",
      },
    ],
  },
  {
    id: "pre-departure-briefing",
    title: "Pre-Departure, Accommodation & Arrival Kit",
    category: "Event",
    objective: "Help offer-holders prepare for travel, university accommodation, enrollment, and first-week essentials.",
    audience: "Students holding unconditional offers and preparing for departure.",
    angle: "Calm, practical checklist for arrival week, university registration, and safe accommodation verification.",
    topic: "Pre-departure & arrival readiness",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "destination", label: "Destination city / country", defaultValue: "your university city" },
      { key: "session_date", label: "Briefing date & time", defaultValue: "[confirm date and time]" },
      { key: "housing_link", label: "Official university accommodation URL", defaultValue: "[add official university housing URL]" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Student Support Team" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Advise students to book accommodation only through official university halls or verified providers.",
      "Remind students never to transfer rent deposits to unverified personal accounts.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Pre-departure checklist & briefing invitation",
        body: "Subject: Pre-departure checklist for {{destination}}\n\nHi {{first_name}},\n\nAs you prepare for {{destination}}, join our pre-departure briefing on {{session_date}}.\n\nKey items we will cover:\n- Booking official university accommodation safely ({{housing_link}})\n- Carrying original academic and enrollment documents in cabin luggage\n- First-week campus registration, banking, and healthcare enrollment\n\nBest wishes,\n{{advisor}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "carousel",
        channel: "Carousel",
        title: "First 72 Hours After Arrival (5 Cards)",
        body: "Card 1 — Arriving at University: First 72 Hours\nCard 2 — Keep enrollment letters, passport, and accommodation confirmation in your hand luggage.\nCard 3 — Check in with your university's International Student Office first.\nCard 4 — Use only official university housing links ({{housing_link}})—never pay cash deposits to unverified listings.\nCard 5 — Complete campus health registration and local emergency contact setup.",
      },
    ],
  },
  {
    id: "parent-early-learning-magnet",
    title: "Bengali Early-Learning Milestone Lead Magnet",
    category: "Lead magnet",
    objective: "Offer Bangladeshi parents a child-safe, age-grouped daily play & language bonding guide.",
    audience: "Parents of children aged 1–6 years following ALO Learning Journey.",
    angle: "10-minute screen-free daily routines in warm Bengali—non-judgmental and pediatrician-aligned.",
    topic: "শিশুর ভাষা ও মনোযোগ বিকাশের দৈনিক রুটিন",
    fields: [
      { key: "parent_name", label: "Parent name", defaultValue: "অভিভাবক" },
      { key: "age_group", label: "Child age group", defaultValue: "১৮ মাস – ৩ বছর" },
      { key: "guide_link", label: "Download / resource link", defaultValue: "[add verified guide URL]" },
      { key: "team_name", label: "Team signature", defaultValue: "আলো লার্নিং জার্নি টিম" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Never use fear-based or child-shaming language; every child develops at their own pace.",
      "Include a clear reminder to consult a pediatrician or speech therapist for developmental concerns.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "১০ মিনিটের ভাষা ও বন্ডিং গাইড (Bengali)",
        body: "Subject: {{age_group}} বয়সী শিশুর জন্য ১০ মিনিটের দৈনিক বন্ডিং রুটিন 💛\n\nপ্রিয় {{parent_name}},\n\nপ্রতিদিন মাত্র ১০ মিনিট স্ক্রিন-মুক্ত কথোপকথন ও ছবির বই পড়া {{age_group}} বয়সী শিশুর ভাষা ও মনোযোগ বিকাশে দারুণ ভূমিকা রাখে।\n\nআমাদের বয়স-ভিত্তিক প্রিন্টেবল চেকলিস্টটি এখানে দেখুন: {{guide_link}}\n\nমনে রাখবেন, প্রতিটি শিশু নিজের গতিতে শেখে—অন্য শিশুর সাথে তুলনা না করে আনন্দের সাথে সময় কাটান। বিশেষ প্রয়োজনে শিশু বিশেষজ্ঞের পরামর্শ নিন।\n\nশুভেচ্ছান্তে,\n{{team_name}}\n\nPreferences: {{preference_link}}",
      },
      {
        id: "social",
        channel: "Social post",
        title: "Bengali Parenting Reel / Post Copy",
        body: "শিশুর সাথে প্রতিদিন মাত্র ১০ মিনিটের ৩টি সহজ খেলা 💛\n১. ছবির বই দেখে গল্প বলা ও প্রশ্ন করা\n২. ঘরের সাধারণ জিনিস দেখিয়ে নাম বলা\n৩. শিশুর কথা মনোযোগ দিয়ে শোনা ও হাসিমুখে সাড়া দেওয়া ✨\nতুলনা নয়, ভালোবাসায় বেড়ে উঠুক প্রতিটি শিশু 🌱 #ALOLearningJourney #ParentingBangla",
      },
    ],
  },
  {
    id: "aarrr-growth-roadmap",
    title: "12-Month AARRR Education Growth & fCMO Plan",
    category: "Growth & CRO",
    objective: "Structure a full-funnel Acquisition, Activation, Retention, Referral, and Revenue roadmap for education teams.",
    audience: "Founders, admissions leads, and marketing operators planning quarterly growth.",
    angle: "Map every channel to measurable AARRR milestones using local AI agents and ethical consent gates.",
    topic: "AARRR full-funnel education marketing plan",
    fields: [
      { key: "company_name", label: "Company / unit name", defaultValue: "ALO Education & Learning" },
      { key: "primary_goal", label: "90-day north-star metric", defaultValue: "150 qualified study-plan consultations" },
      { key: "core_channel", label: "Primary acquisition channel", defaultValue: "Bengali educational short-form video + SEO" },
      { key: "owner", label: "Plan owner", defaultValue: "Growth & Admissions Lead" },
    ],
    guardrails: [
      "Base conversion projections on historical CRM stage progression, not unverified industry averages.",
      "Keep all email/WhatsApp activation steps strictly opt-in.",
    ],
    assets: [
      {
        id: "landing",
        channel: "Landing page",
        title: "AARRR 90-Day & 12-Month Roadmap Blueprint",
        body: "Organization: {{company_name}}\n90-Day North Star: {{primary_goal}}\nPrimary Engine: {{core_channel}}\nOwner: {{owner}}\n\n1. ACQUISITION: Weekly Bengali educational reels + programmatic country/milestone SEO briefs.\n2. ACTIVATION: Interactive study-abroad readiness checklist & 15-minute discovery booking.\n3. RETENTION: Intake deadline reminders & parent/student Q&A webinars.\n4. REFERRAL: Alumni & family pre-departure community introductions.\n5. REVENUE: Transparent, itemised BDT/GBP quotations in Admissions CRM.",
      },
      {
        id: "email",
        channel: "Email",
        title: "Quarterly Growth Alignment Memo",
        body: "Subject: Q4 AARRR Growth Plan for {{company_name}}\n\nTeam,\n\nOur 90-day focus is {{primary_goal}} driven by {{core_channel}}. Every campaign asset must pass our three-agent editorial review and human compliance checklist before launch.\n\nOwner: {{owner}}",
      },
    ],
  },
  {
    id: "gtm-enrichment-waterfall",
    title: "Partner Institution & School Outreach Waterfall",
    category: "Growth & CRO",
    objective: "Run an evidence-backed B2B partnership outreach sequence inspired by OpenProspector & Market Intelligence Radar.",
    audience: "School career counselors, language centers, and university partnership officers.",
    angle: "Reference a verified institutional signal (new programme, intake update, or career fair) before proposing collaboration.",
    topic: "Evidence-led institutional partnership outreach",
    fields: [
      { key: "contact_name", label: "Contact name", defaultValue: "Counselling Coordinator" },
      { key: "partner_org", label: "Partner school / institution", defaultValue: "[insert school or university name]" },
      { key: "verified_signal", label: "Verified public signal", defaultValue: "[insert verified event or course announcement]" },
      { key: "sender_name", label: "Sender name", defaultValue: "ALO Partnerships Team" },
      { key: "preference_link", label: "Opt-out / preference link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Verify the partner signal on the institution's public website before referencing it.",
      "Do not scrape private personal data; use only official institutional contact channels.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Signal-led institutional partnership note",
        body: "Subject: Collaboration around {{partner_org}}'s upcoming study sessions\n\nHi {{contact_name}},\n\nWe noticed {{verified_signal}} at {{partner_org}}. Our team prepares verified country-readiness checklists (UK, Canada, USA, Australia, Germany) for students and parents.\n\nIf helpful for your upcoming advising calendar, we would be glad to share our open checklist pack for review.\n\nBest regards,\n{{sender_name}}\n\nOpt out of partnership notes: {{preference_link}}",
      },
    ],
  },
  {
    id: "cro-landing-offer-audit",
    title: "Landing Page CRO & Offer Clarity Kit",
    category: "Growth & CRO",
    objective: "Audit and rewrite an education landing page using the Clarity-Over-Cleverness and Supportable-Claims framework.",
    audience: "Prospective students and parents arriving from search or social campaigns.",
    angle: "State who the service is for, what happens in the first consultation, and what is never promised.",
    topic: "High-clarity landing page & offer copy",
    fields: [
      { key: "headline_offer", label: "Core consultation offer", defaultValue: "Free 20-Minute Study Abroad Readiness Review" },
      { key: "target_audience", label: "Specific audience", defaultValue: "Bangladeshi HSC & Undergraduate students targeting 2027 intakes" },
      { key: "proof_point", label: "Verified proof point", defaultValue: "[insert verified metric or advisor credential]" },
      { key: "cta_link", label: "Primary CTA URL", defaultValue: "[add verified booking link]" },
    ],
    guardrails: [
      "Every quantitative claim must cite its verified source; declined claims must name the evidence required to unlock them.",
      "Remove high-friction form fields (never ask for passport numbers on an initial enquiry form).",
    ],
    assets: [
      {
        id: "landing",
        channel: "Landing page",
        title: "CRO-Audited Hero & Value Stack",
        body: "HERO HEADLINE: {{headline_offer}}\nFOR: {{target_audience}}\nVERIFIED CREDENTIAL: {{proof_point}}\n\nWHAT YOU GET IN 20 MINUTES:\n1. Side-by-side comparison of 3 accredited universities matching your grades and budget.\n2. Official visa & financial document timeline sourced from GOV.UK / IRCC / Home Affairs.\n3. Written fee & scholarship verification checklist.\n\nTRANSPARENCY PROMISE: Admission and visa decisions are made by institutions and governments—we never guarantee outcomes.\n\nPRIMARY CTA: Book your readiness review → {{cta_link}}",
      },
    ],
  },
  // ── Drip sequence kits (marketingskills emails/sequence-templates + cold-email follow-up + Email_Markting automations) ──
  {
    id: "welcome-nurture-sequence",
    title: "7-Touch Welcome & Lead-Nurture Drip",
    category: "Enquiry follow-up",
    objective: "Deliver the promised lead magnet, then nurture a new enquiry to a consultation decision over 14 days.",
    audience: "Parents and students who downloaded a checklist or joined the list and asked for updates.",
    angle: "Deliver value first, then story, proof, objection handling, and one clear offer — one new value piece per touch.",
    topic: "Welcome & nurture sequence",
    sourceInspiration: "coreyhaines31/marketingskills skills/emails/references/sequence-templates.md (Welcome Sequence) + knsoftic/Email_Markting automations",
    trigger: "lead_magnet_downloaded",
    sendWindow: "Tue–Thu, 9–11 AM or 1–3 PM recipient-local time. Avoid Monday mornings and Friday afternoons.",
    cadence: [
      { day: 0, channel: "Email", angle: "Deliver + introduce", note: "Give the promised checklist immediately. One next action. Set expectations." },
      { day: 1, channel: "Email", angle: "Quick win", note: "Help them use the checklist for one small success today." },
      { day: 3, channel: "Email", angle: "Story / why", note: "Why ALO verifies official sources — short origin note." },
      { day: 5, channel: "WhatsApp", angle: "Social proof", note: "A relatable anonymised outcome; soft CTA to the readiness review." },
      { day: 7, channel: "Email", angle: "Overcome objection", note: "Address the 'no time / too late' hesitation with a simple path." },
      { day: 10, channel: "Email", angle: "Core resource", note: "Point at the country pathway kit that matches their enquiry." },
      { day: 14, channel: "Email", angle: "Consultation offer", note: "Summarise value, clear offer, no manufactured urgency." },
    ],
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "magnet", label: "Delivered lead magnet", defaultValue: "your checklist" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Education team" },
      { key: "booking_link", label: "Booking link", defaultValue: "[add verified booking link]" },
    ],
    guardrails: [
      "Each touch adds one genuinely new value piece — never 'just bumping this'.",
      "No manufactured urgency; deadline claims must link to the official source.",
      "Preference/unsubscribe link on every email; STOP handling on WhatsApp.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Day 0 — deliver the magnet",
        sequenceDay: 0,
        abVariants: ["Subject: Your {{magnet}} is inside", "Subject: Here's the {{magnet}} you asked for"],
        body: "Subject: Your {{magnet}} is inside\n\nHi {{first_name}},\n\nHere is the {{magnet}} you asked for. The fastest way to use it: pick the one section that matches your situation this week and complete just that.\n\nOver the next two weeks I will send a few short notes on verifying official sources, timing, and common questions. One clear next step when you are ready: {{booking_link}}\n\nKind regards,\n{{advisor}}",
      },
      {
        id: "email",
        channel: "Email",
        title: "Day 3 — why we verify",
        sequenceDay: 3,
        body: "Subject: Why every ALO checklist links to the official source\n\nHi {{first_name}},\n\nOne reason our checklists look different: every requirement we list is checked against the official institution or government page on the day we publish it, and re-checked each term.\n\nIf a detail matters to your plan, open the source link in the checklist and confirm it yourself — that habit protects every application.\n\n{{advisor}}",
      },
      {
        id: "whatsapp",
        channel: "WhatsApp",
        title: "Day 5 — proof note",
        sequenceDay: 5,
        body: "Hi {{first_name}} — a short example: a family we advised last term used the same {{magnet}} to build their question list, then confirmed three details directly with the institution before booking anything. If a chat helps, {{booking_link}}. Reply STOP to opt out.",
      },
    ],
  },
  {
    id: "partner-followup-cadence",
    title: "Partner Outreach 5-Touch Follow-Up Cadence",
    category: "Growth & CRO",
    objective: "Run a 5-touch, angle-rotated outreach cadence to school counsellors and university representatives.",
    audience: "School counsellors, teachers, and university international-office representatives.",
    angle: "Each follow-up stands alone with a new angle (value → insight → proof → resource → respectful close). Never 'just bumping this'.",
    topic: "Institutional partner outreach cadence",
    sourceInspiration: "coreyhaines31/marketingskills skills/cold-email/references/follow-up-sequences.md (cadence + breakup email)",
    trigger: "partner_list_approved",
    sendWindow: "Tuesday–Thursday peaks (Thursday 6.87% reply rate). 9–11 AM or 1–3 PM local. Cap at 5 emails total.",
    cadence: [
      { day: 0, channel: "Email", angle: "Personalised hook + value prop + soft CTA", note: "Maximum personalisation investment." },
      { day: 3, channel: "Email", angle: "New value piece (stat or resource)", note: "Waiting 3 days lifts response up to 31%." },
      { day: 7, channel: "Email", angle: "Social proof from a similar institution", note: "Different angle — one new value proposition only." },
      { day: 14, channel: "Email", angle: "New insight or trend resource", note: "Demonstrate expertise without pressure." },
      { day: 21, channel: "Email", angle: "Breakup — leave the door open", note: "Acknowledge silence; 10–15% reply rates on breakups (Close.com). After this, stop." },
    ],
    fields: [
      { key: "contact_name", label: "Contact name", defaultValue: "there" },
      { key: "institution", label: "Institution / school", defaultValue: "your institution" },
      { key: "signal", label: "Trigger signal observed", defaultValue: "your recent programme update" },
      { key: "sender", label: "Sender name & role", defaultValue: "ALO Education partnerships" },
    ],
    guardrails: [
      "Only contact professional addresses with a legitimate-interest basis; honour opt-outs within one working day.",
      "Cap at 5 emails total — past the 4th follow-up spam complaints triple (Woodpecker research).",
      "The breakup email states it is the final message and means it.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Day 0 — personalised intro",
        sequenceDay: 0,
        abVariants: ["Subject: A verified-checklist idea for {{institution}} students", "Subject: Quick idea after {{signal}}"],
        body: "Subject: A verified-checklist idea for {{institution}} students\n\nHi {{contact_name}},\n\nI noticed {{signal}}. We help students compare study options using checklists that link every requirement to its official source.\n\nIf useful, I can share the {{institution}}-specific question sheet we prepared — no call required.\n\nBest,\n{{sender}}",
      },
      {
        id: "email",
        channel: "Email",
        title: "Day 21 — breakup",
        sequenceDay: 21,
        body: "Subject: Closing the loop, {{contact_name}}\n\nHi {{contact_name}},\n\nI have reached out a couple of times and understand this may not be a priority. This is my last note for now — if comparing verified checklists becomes useful later, just reply and I will send the sheet.\n\nWishing {{institution}} a strong term.\n\n{{sender}}",
      },
    ],
  },
  {
    id: "reengagement-recovery",
    title: "Stalled Enquiry Re-Engagement Recovery",
    category: "Lifecycle & Retention",
    objective: "Re-engage enquiries that went quiet after counselling with helpful checklists, not pressure.",
    audience: "CRM leads stalled 14+ days after a counselling conversation.",
    angle: "Helpful check-in with one new useful asset; acknowledges silence without guilt or false urgency.",
    topic: "Re-engagement drip",
    sourceInspiration: "coreyhaines31/marketingskills skills/emails (Re-Engagement Sequence) + blader/humanizer voice rules",
    trigger: "lead_stalled_14d",
    sendWindow: "Recipient-local Tuesday–Thursday mornings. Stop all sends on reply or opt-out.",
    cadence: [
      { day: 0, channel: "Email", angle: "Helpful check-in + one new asset", note: "No guilt, no 'just bumping'." },
      { day: 7, channel: "WhatsApp", angle: "Answer the likely objection", note: "Timing, cost, or readiness — ask which is blocking." },
      { day: 21, channel: "Email", angle: "Respectful close", note: "Leave the door open; remove from nurture after this." },
    ],
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "course", label: "Course / subject", defaultValue: "your course options" },
      { key: "asset", label: "New useful asset", defaultValue: "the updated readiness checklist" },
    ],
    guardrails: [
      "Never invent deadlines or scarcity to force a reply.",
      "Stop the sequence on any reply; move the lead to manual follow-up.",
      "After the final touch, suppress the lead from nurture for 90 days.",
    ],
    assets: [
      {
        id: "email",
        channel: "Email",
        title: "Day 0 — check-in",
        sequenceDay: 0,
        abVariants: ["Subject: A useful update for your {{course}} plan", "Subject: Still comparing {{course}} options?"],
        body: "Subject: A useful update for your {{course}} plan\n\nHi {{first_name}},\n\nWe updated {{asset}} this month, and it may help with the questions you were comparing. Here is the direct link.\n\nIf your plans changed, that is completely fine — just reply and tell us what would be useful now (or nothing at all).\n\n{{advisor}}",
      },
      {
        id: "whatsapp",
        channel: "WhatsApp",
        title: "Day 7 — unblock question",
        sequenceDay: 7,
        body: "Hi {{first_name}} — when a plan goes quiet it is usually timing, cost, or readiness. Which one is the current blocker? Happy to send just the relevant checklist. Reply STOP to opt out.",
      },
    ],
  },
]

/**
 * 50 Marketing Skills Reference Matrix (inspired by coreyhaines31/marketingskills).
 */
export const MARKETING_SKILLS_CATALOG: MarketingSkillItem[] = [
  { slug: "marketing-plan", title: "12-Month AARRR Marketing Plan", group: "Strategy & Planning", summary: "13-section fCMO growth plan across Acquisition, Activation, Retention, Referral, and Revenue.", aloApplication: "Aligns ALO Learning Journey content with Admissions CRM intake cycles.", deliverable: "Notion-ready 90-day + 12-month AARRR markdown plan" },
  { slug: "marketing-ideas", title: "139 Proven Marketing Ideas Library", group: "Strategy & Planning", summary: "Curated growth experiments ranked by stage, budget, and channel fit.", aloApplication: "Seeds Topic Ideas and Growth Loop experiments for parents & students.", deliverable: "Prioritized 5-experiment sprint backlog" },
  { slug: "marketing-loops", title: "Compounding Growth Loops", group: "Strategy & Planning", summary: "Designs self-reinforcing viral, content, and community flywheels.", aloApplication: "Powers the ALO 6-stage Growth Loop (Topic → Hook → Package → Publish → Measure → Learn).", deliverable: "Loop diagram + bottleneck diagnostic" },
  { slug: "marketing-psychology", title: "Behavioral Science & Mental Models", group: "Strategy & Planning", summary: "Applies Jobs-to-Be-Done, First Principles, and ethical framing without dark patterns.", aloApplication: "Ensures parent/student communication lowers anxiety instead of manufacturing false urgency.", deliverable: "Behavioral framing audit" },
  { slug: "product-marketing", title: "Positioning & ICP Messaging Context", group: "Strategy & Planning", summary: "Defines Ideal Customer Profile, category entry points, and message-market fit.", aloApplication: "Separates Early Childhood Parenting voice from Study Abroad Admissions voice.", deliverable: "Product marketing context sheet" },
  { slug: "competitors", title: "Competitive Landscape Matrix", group: "Strategy & Planning", summary: "Maps alternative solutions and transparent differentiation.", aloApplication: "Positions ALO on transparency, official source verification, and child safety.", deliverable: "Honest comparison matrix" },
  { slug: "competitor-profiling", title: "Deep Competitor Messaging Audit", group: "Strategy & Planning", summary: "Analyzes competitor offers, ad angles, and content gaps.", aloApplication: "Finds underserved Bengali parenting and country-specific admission topics.", deliverable: "Content gap report" },
  { slug: "customer-research", title: "Voice-of-Customer Synthesis", group: "Strategy & Planning", summary: "Extracts exact phrases, questions, and hesitations from enquiries and comments.", aloApplication: "Mines Comment Inbox and CRM Lead Activities for real parent/student questions.", deliverable: "VoC objection & question bank" },
  { slug: "content-strategy", title: "Pillar & Topic Cluster Architecture", group: "Strategy & Planning", summary: "Organizes editorial calendars around search intent and audience journey stages.", aloApplication: "Structures the 15 ALO content categories and 6 age groups.", deliverable: "30-day multi-channel editorial calendar" },
  { slug: "launch", title: "Intake & Campaign Launch Playbook", group: "Strategy & Planning", summary: "Orchestrates pre-launch, launch day, and post-launch follow-through.", aloApplication: "Coordinates September/January university intake awareness windows.", deliverable: "Launch runbook & checklist" },
  { slug: "copywriting", title: "Clarity-First Conversion Copywriting", group: "Copy & Content", summary: "Writes specific, supportable headlines, value propositions, and CTAs without AI slop.", aloApplication: "Drives landing page, social, and consultation copy with strict claim guardrails.", deliverable: "Audited page copy + unlock paths for declined claims" },
  { slug: "copy-editing", title: "7-Sweep Copy Editing & Tightening", group: "Copy & Content", summary: "Edits prose for clarity, voice, specificity, emotion, and zero fluff.", aloApplication: "Powers the Finalist Editor pass in our 3-agent refinement pipeline.", deliverable: "Redlined & tightened final copy" },
  { slug: "emails", title: "Lifecycle & Drip Email Sequences", group: "Copy & Content", summary: "Designs welcome, nurture, event, and deadline verification email flows.", aloApplication: "Powers Marketing Kits email templates and 3-agent email refinement.", deliverable: "Multi-step merge-tag email sequence" },
  { slug: "cold-email", title: "Signal-Led B2B Partner Outreach", group: "Copy & Content", summary: "Writes concise, evidence-based institutional partnership emails.", aloApplication: "Used for school counselor and university representative introductions.", deliverable: "3-touch partner outreach sequence" },
  { slug: "social", title: "Multi-Platform Social Distribution", group: "Copy & Content", summary: "Adapts core narratives for Facebook, Instagram, YouTube, LinkedIn, and TikTok.", aloApplication: "Generates platform-native Bengali captions, hooks, and carousels.", deliverable: "Platform-tailored social asset pack" },
  { slug: "video", title: "Short-Form Reel & Storyboard Scripting", group: "Copy & Content", summary: "Structures 3-second hooks, visual beats, captions, and CTAs for vertical video.", aloApplication: "Drives `/api/video/generate` and `/api/video/cinematic` storyboards.", deliverable: "Scene-by-scene 9:16 storyboard + SRT captions" },
  { slug: "ad-creative", title: "Ad Creative & Hook Iteration", group: "Copy & Content", summary: "Produces multi-angle creative variants for testing.", aloApplication: "Generates 5 psychological hook types (question, empathy, curiosity, stat, story).", deliverable: "Hook & creative variant matrix" },
  { slug: "image", title: "Editorial Illustration Prompting", group: "Copy & Content", summary: "Crafts brand-consistent, child-safe visual prompts without text artifacts.", aloApplication: "Powers the 3-agent Image Prompt Refinement pipeline.", deliverable: "Child-safe editorial illustration prompt" },
  { slug: "sms", title: "Opt-In SMS & WhatsApp Reminders", group: "Copy & Content", summary: "Writes ultra-concise, STOP-compliant appointment and deadline nudges.", aloApplication: "Used for consultation reminders and OTP verification flows.", deliverable: "160-character compliant SMS/WhatsApp copy" },
  { slug: "public-relations", title: "Educational Press & Community Announcements", group: "Copy & Content", summary: "Shapes newsworthy community milestones and institutional partnerships.", aloApplication: "Drafts workshop announcements and community impact summaries.", deliverable: "Press & community briefing note" },
  { slug: "cro", title: "Conversion Rate Optimization (CRO)", group: "Conversion & Offers", summary: "Diagnoses landing page friction, form abandonment, and trust gaps.", aloApplication: "Keeps Admissions CRM enquiry forms low-friction and consent-transparent.", deliverable: "Prioritized CRO hypothesis list" },
  { slug: "offers", title: "High-Value Offer Construction", group: "Conversion & Offers", summary: "Improves the underlying consultation or educational offer before writing copy.", aloApplication: "Packages free study-readiness reviews and printable parent checklists.", deliverable: "Value stack & transparency charter" },
  { slug: "lead-magnets", title: "Educational Checklists & Resource Magnets", group: "Conversion & Offers", summary: "Plans high-utility downloadable checklists, calculators, and templates.", aloApplication: "Creates age-based parenting checklists and country visa readiness sheets.", deliverable: "Lead magnet spec + delivery flow" },
  { slug: "free-tools", title: "Interactive Calculators & Assessments", group: "Conversion & Offers", summary: "Designs interactive self-serve tools that deliver immediate value.", aloApplication: "Informs our Study Abroad Cost Planner and Topic Virality Scorer.", deliverable: "Interactive tool specification" },
  { slug: "pricing", title: "Transparent Service Packaging & Tiers", group: "Conversion & Offers", summary: "Structures clear, itemised service packages and fee schedules.", aloApplication: "Powers Admissions CRM Quotation Builder line-item templates.", deliverable: "Itemised BDT/GBP quotation schedule" },
  { slug: "signup", title: "Low-Friction Enquiry & Registration Flows", group: "Conversion & Offers", summary: "Minimizes fields and clarifies privacy consent at the point of capture.", aloApplication: "Guides LeadFormDialog consent recording in Admissions CRM.", deliverable: "Streamlined enquiry form spec" },
  { slug: "popups", title: "Non-Intrusive Exit & Scroll Prompts", group: "Conversion & Offers", summary: "Designs respectful, value-led opt-in prompts without dark patterns.", aloApplication: "Captures event registrations and checklist downloads ethically.", deliverable: "Trigger & copy specification" },
  { slug: "paywalls", title: "Tiered Resource & Workshop Access", group: "Conversion & Offers", summary: "Defines what stays 100% free vs premium advisory packages.", aloApplication: "Keeps core parenting & official visa checklists free for all families.", deliverable: "Free-vs-advisory boundary matrix" },
  { slug: "ab-testing", title: "Statistical Experiment Design", group: "Conversion & Offers", summary: "Formulates clean A/B hypotheses, sample sizes, and primary metrics.", aloApplication: "Tests hook styles and CTA phrasing in the Growth Loop.", deliverable: "Experiment design card" },
  { slug: "sales-enablement", title: "Counsellor Decks & Objection Playbooks", group: "Conversion & Offers", summary: "Equips admissions advisors with verified comparison sheets and FAQs.", aloApplication: "Links RAG Knowledge Base documents directly to counsellor workflows.", deliverable: "Counsellor reference battlecard" },
  { slug: "seo-audit", title: "Technical & On-Page SEO Audit", group: "Acquisition & SEO", summary: "Diagnoses title tags, meta descriptions, headings, schema, and crawlability.", aloApplication: "Built into the SEO Command Center (`/api/content/brief` + Audit tab).", deliverable: "Scored on-page SEO checklist" },
  { slug: "programmatic-seo", title: "Programmatic SEO (pSEO) at Scale", group: "Acquisition & SEO", summary: "Builds high-utility template pages for `[Country] + [Degree]` and `[Age] + [Milestone]`.", aloApplication: "Powers the pSEO Matrix in SEO Command Center.", deliverable: "pSEO URL & template schema" },
  { slug: "ai-seo", title: "AI Search & Answer Engine Optimization (GEO)", group: "Acquisition & SEO", summary: "Structures citation-ready facts and FAQs for AI search engines.", aloApplication: "Formats Bengali/English parenting and study-abroad briefs for citation.", deliverable: "GEO citation block + FAQ pairs" },
  { slug: "schema", title: "JSON-LD Structured Data Generator", group: "Acquisition & SEO", summary: "Generates valid `FAQPage`, `Article`, `Course`, and `EducationalOrganization` JSON-LD.", aloApplication: "Available directly inside SEO Command Center.", deliverable: "Validated JSON-LD snippet" },
  { slug: "site-architecture", title: "Hub-and-Spoke Information Architecture", group: "Acquisition & SEO", summary: "Organizes internal linking between pillar guides and cluster articles.", aloApplication: "Connects the 4 Bengali SEO clusters with internal link graphs.", deliverable: "Internal linking topology" },
  { slug: "ads", title: "Paid Search & Social Campaign Strategy", group: "Acquisition & SEO", summary: "Plans Meta, Google, and YouTube educational awareness campaigns.", aloApplication: "Aligns paid boost budgets with high-scoring organic reels.", deliverable: "Paid campaign structure & negative keyword list" },
  { slug: "aso", title: "App & Resource Directory Optimization", group: "Acquisition & SEO", summary: "Optimizes titles, screenshots, and descriptions for marketplaces.", aloApplication: "Improves discoverability of downloadable parent/student toolkits.", deliverable: "Listing metadata pack" },
  { slug: "directory-submissions", title: "Education Portal & Directory Listings", group: "Acquisition & SEO", summary: "Identifies reputable education and parenting directories.", aloApplication: "Builds authoritative local citations for ALO Education.", deliverable: "Verified directory checklist" },
  { slug: "influencer-marketing", title: "Educator & Pediatrician Collaborations", group: "Acquisition & SEO", summary: "Structures ethical co-creation with teachers, doctors, and alumni.", aloApplication: "Guides guest Q&A sessions and expert-reviewed reels.", deliverable: "Creator briefing & disclosure checklist" },
  { slug: "co-marketing", title: "Joint Webinars & School Partnerships", group: "Acquisition & SEO", summary: "Plans co-branded workshops with schools and language institutes.", aloApplication: "Supports joint IELTS & study-planning information sessions.", deliverable: "Co-marketing partner kit" },
  { slug: "onboarding", title: "Student & Parent Welcome Journey", group: "Lifecycle & Retention", summary: "Guides new enquiries from first contact to their first milestone.", aloApplication: "Standardizes the `new → qualified → counselled` CRM experience.", deliverable: "7-day onboarding checklist" },
  { slug: "events", title: "Live Webinar & Q&A Operations", group: "Lifecycle & Retention", summary: "Manages registration, opt-in reminders, live run-of-show, and replay notes.", aloApplication: "Powers the Student & Family Q&A Session kit.", deliverable: "Event run-of-show & follow-up pack" },
  { slug: "community-marketing", title: "Safe Parent & Student Community Moderation", group: "Lifecycle & Retention", summary: "Builds supportive, moderated community spaces with zero medical/legal overreach.", aloApplication: "Works alongside CommentModerationAgent and CommunityReplyAgent.", deliverable: "Community moderation charter" },
  { slug: "churn-prevention", title: "Application Drop-Off & Follow-Up Recovery", group: "Lifecycle & Retention", summary: "Identifies stalled enquiries and re-engages them with helpful checklists.", aloApplication: "Highlights overdue follow-ups in Admissions CRM.", deliverable: "Re-engagement check-in template" },
  { slug: "referrals", title: "Alumni & Family Word-of-Mouth Program", group: "Lifecycle & Retention", summary: "Encourages satisfied families to refer friends ethically.", aloApplication: "Triggers after `enrolled` stage completion in Admissions CRM.", deliverable: "Referral invitation card" },
  { slug: "analytics", title: "Privacy-First Funnel & Content Analytics", group: "Ops & Intelligence", summary: "Tracks content engagement and CRM stage velocity without invasive tracking.", aloApplication: "Powers the Analytics and Growth Loop dashboards.", deliverable: "KPI scorecard & cohort summary" },
  { slug: "attribution", title: "Enquiry Source & Channel Attribution", group: "Ops & Intelligence", summary: "Maps how content topics and campaigns convert into qualified enquiries.", aloApplication: "Tracks `source` (`website`, `facebook`, `whatsapp`, `referral`, `walk_in`) in CRM.", deliverable: "Source attribution breakdown" },
  { slug: "prospecting", title: "Waterfall Lead Enrichment & Signal Radar", group: "Ops & Intelligence", summary: "Verifies institutional domains, intake windows, and public signals at lowest cost.", aloApplication: "Integrated into Admissions CRM Enrichment Waterfall tab.", deliverable: "Verified enrichment waterfall trace" },
  { slug: "revops", title: "Admissions Pipeline & Quotation Hygiene", group: "Ops & Intelligence", summary: "Standardizes stage definitions, SLA timers, and quotation numbering.", aloApplication: "Enforces `ALO-YYYY-*` quotation numbering and stage audit trails.", deliverable: "Pipeline SLA & governance spec" },
  { slug: "marketing-council", title: "Multi-Agent Editorial & Safety Review Council", group: "Ops & Intelligence", summary: "Runs Writer → Critic → Finalist + Safety Guardian passes on every asset.", aloApplication: "Core architecture of ALO's local multi-agent quality pipeline.", deliverable: "3-agent quality & safety audit log" },
];
