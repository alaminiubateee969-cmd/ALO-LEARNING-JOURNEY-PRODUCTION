# Bangla Voice Model Evaluation Plan

**Document:** `docs/voice-contact-center/BANGLA_VOICE_MODEL_EVALUATION.md`
**Date:** 2026-11-05
**Status:** Evaluation plan — no models have been downloaded or evaluated yet.
**Approval gate:** Owner must approve the evaluation methodology + reviewer panel before evaluation begins.

---

## 1. Why this document exists

The directive (§3 Module C, §12) is explicit:

> Do not assume a model supports high-quality Bangla merely because it supports multilingual transcription.
> Do not label a voice human-like based only on a model's marketing description.
> Use native Bangla-speaking reviewers to evaluate pronunciation, naturalness, intelligibility, and conversational quality.

This document defines the methodology, corpus, scoring rubric, and acceptance threshold for evaluating Bangla TTS and ASR models. **No model is marked production-ready until this evaluation passes.**

## 2. Evaluation scope

Two evaluations are required:

1. **TTS (Text-to-Speech)** — given Bangla text, does the model produce natural-sounding Bangladeshi Bangla (`bn-BD`) speech?
2. **ASR (Speech-to-Text)** — given Bangladeshi Bangla audio, does the model transcribe it accurately?

Both evaluations use the same corpus, the same reviewer panel, and the same scoring rubric.

## 3. Evaluation corpus

### 3.1 Corpus design

The corpus contains **100 sentences** organized into 10 categories of 10 sentences each. The categories are designed to stress different aspects of Bangla pronunciation:

| # | Category | Coverage |
|---|---|---|
| 1 | Standard declarative | "আমি আজকে অফিসে যাব।" (I will go to the office today.) |
| 2 | Questions | "আপনি কি এই পরিষেবা ব্যবহার করতে চান?" (Would you like to use this service?) |
| 3 | Numbers, dates, currency | "আপনার বিল ১,২৫০ টাকা, যেহেতু আজ ২৬ মার্চ ২০২৬।" (Your bill is 1,250 taka, as today is 26 March 2026.) |
| 4 | Addresses | "বাসা ১২, রোড ৫, ধানমন্ডি, ঢাকা ১২০৫।" (House 12, Road 5, Dhanmondi, Dhaka 1205.) |
| 5 | Business + technical vocabulary | "আপনার সাবস্ক্রিপশন প্ল্যান রিনিউ করতে হবে।" (Your subscription plan needs to be renewed.) |
| 6 | Bangla-English code-switching | "আমি আপনার account verify করতে চাই।" (I want to verify your account.) |
| 7 | Regional vocabulary (Dhaka, Chittagong, Sylhet) | Sylheti: "আমি যাইতে পারম না।" vs Standard: "আমি যেতে পারি না।" |
| 8 | Long sentences (>20 words) | Multi-clause business policy statements |
| 9 | Short utterances (<5 words) | IVR prompts: "অপেক্ষা করুন।" (Please wait.) |
| 10 | Noisy-environment stress test | Same sentences but with 10 dB background noise added |

### 3.2 Speaker diversity (for ASR)

The ASR corpus requires audio from at least **6 native speakers**:

- 3 male, 3 female
- Age ranges: 18-30, 30-45, 45-60
- Dialects: Standard Bangla (Dhaka), Chittagonian (চাটগাঁইয়া), Sylheti (সিলেটি)
- Each speaker records the 100-sentence corpus at 16 kHz mono WAV

### 3.3 Voice consent (for TTS evaluation)

For TTS, the corpus is text-only (no human recordings needed for evaluation). However, if a custom voice is trained (Piper fine-tuning or Tortoise cloning), the voice owner must sign the `VoiceCloneAuthorization` form (Phase 3 work) before any recording happens.

### 3.4 Corpus licensing

The corpus is built specifically for this evaluation. Sentences are either:

- Original (written for this evaluation), OR
- Public-domain (e.g., government notices), OR
- Licensed under CC-BY-4.0 from a willing author with documented consent.

No copyrighted material is used. The corpus itself is released under CC-BY-4.0 so other Bangla voice projects can use it.

## 4. Models under evaluation

### 4.1 TTS models

| # | Model | License | Voice(s) | Notes |
|---|---|---|---|---|
| T1 | Piper `bn_BD-google-medium` | MIT | 16 voices (multi-speaker pack) | Default candidate; runs on CPU |
| T2 | Piper `bn_BD-google-low` | MIT | same | Lower quality, smaller footprint |
| T3 | Kokoro (Apache 2.0) | Apache 2.0 | TBD | License OK; Bangla quality unverified |
| T4 | CosyVoice (Apache 2.0) | Apache 2.0 | TBD | License OK; recent (2024-2025); quality unverified |
| T5 | Z.AI cloud TTS (existing) | free tier | default voice | Baseline; already in production |
| T6 | Tortoise (Apache 2.0) | Apache 2.0 | 4 preset voices | Slow (batch only); used for IVR prompt generation |

**Rejected (not in evaluation):**

- Coqui XTTS v2 — CPML non-commercial license; Coqui AI shut down Jan 2024
- F5-TTS — CC-BY-NC-4.0 non-commercial license
- Meta SeamlessM4T — CC-BY-NC-4.0 non-commercial license

### 4.2 ASR models

| # | Model | License | Notes |
|---|---|---|---|
| A1 | faster-whisper large-v3 | MIT | Default candidate; GPU recommended |
| A2 | faster-whisper medium | MIT | CPU-friendly fallback |
| A3 | WhisperX (faster-whisper + diarization) | BSD-4-clause | Adds speaker diarization |
| A4 | whisper.cpp large-v3 | MIT | CPU-only; quantized |
| A5 | Z.AI cloud ASR (existing) | free tier | Baseline; already in production |

## 5. Evaluation methodology

### 5.1 TTS evaluation

For each TTS model × each of the 100 corpus sentences:

1. Generate audio at default settings (speed=1.0, pitch=1.0).
2. Save as 16 kHz mono WAV.
3. Generate a 5-second clip from the middle of each sentence (to focus on quality, not start/end artifacts).
4. Submit each clip to the reviewer panel (3+ native speakers).
5. Each reviewer scores on 4 dimensions, 1-5 scale:
   - **Pronunciation** — is the Bangla pronounced correctly? (1=incorrect, 5=native)
   - **Naturalness** — does it sound like a real person? (1=robot, 5=indistinguishable)
   - **Intelligibility** — can the words be understood? (1=unintelligible, 5=clear)
   - **Conversational quality** — would this be acceptable on a phone call? (1=no, 5=yes)
6. Aggregate scores; a model passes if mean score ≥ 3.5 on all 4 dimensions AND ≥ 4.0 on conversational quality for the IVR subset (categories 1, 2, 9).

### 5.2 ASR evaluation

For each ASR model × each of the 100 corpus sentences × each of the 6 speakers (600 audio files per model):

1. Run inference.
2. Compare predicted transcript to ground-truth transcript.
3. Compute:
   - **WER (Word Error Rate)** — `% words wrong` = `(substitutions + insertions + deletions) / total words`
   - **CER (Character Error Rate)** — same but at character level (more sensitive to Bangla spelling)
4. Run on noisy versions (category 10) separately.
5. A model passes if:
   - WER ≤ 15% on clean audio
   - WER ≤ 25% on noisy audio
   - CER ≤ 10% on clean audio
   - Code-switching accuracy (category 6) ≥ 80% of English words correctly transcribed

### 5.3 Latency measurement

For both TTS and ASR, measure:

- **First-audio response latency (TTS):** time from `synthesize(text)` call to first audio chunk returned.
- **Streaming transcription latency (ASR):** time from audio chunk arrival to partial transcript.
- **End-to-end conversational latency:** sum of ASR + LLM + TTS first-chunk, measured on a real call.

**Acceptance thresholds** (per directive §8):

- TTS first-audio: ≤ 400 ms
- ASR partial: ≤ 300 ms
- End-to-end conversational: ≤ 1.5 s (target ≤ 1 s for "natural")

## 6. Reviewer panel

### 6.1 Composition

- Minimum 3 reviewers, recommended 5.
- All reviewers must be native Bangla speakers raised in Bangladesh.
- At least 1 reviewer with formal linguistics or speech therapy background.
- At least 1 reviewer from each of the 3 regions (Dhaka, Chittagong, Sylhet).
- Reviewers are paid for their time; rate is documented.

### 6.2 Conflict of interest

Reviewers must disclose:

- Any affiliation with a TTS/ASR vendor.
- Any prior work on Bangla voice datasets.
- Any personal relationship with the model trainers (if custom training is involved).

### 6.3 Reviewer agreement

Inter-rater reliability is measured using Krippendorff's alpha. If α < 0.6, the evaluation is repeated with a clearer rubric or different reviewers.

## 7. Hardware requirements for evaluation

| Component | Purpose | Spec |
|---|---|---|
| GPU worker | faster-whisper large-v3 inference | NVIDIA RTX 3090 (24 GB) or equivalent |
| CPU worker | Piper / Kokoro / whisper.cpp inference | 4 vCPU, 8 GB RAM |
| Storage | Audio files + transcripts | 50 GB |
| Reviewer workstations | Listening tests | Quiet room, good headphones, no time pressure |

If a GPU worker is not available, faster-whisper-large-v3 evaluation runs on CPU (slower but feasible for offline evaluation).

## 8. Acceptance thresholds (summary)

| Metric | Threshold | Rationale |
|---|---|---|
| TTS conversational quality (IVR subset) | ≥ 4.0 / 5 | Calls are the primary use case |
| TTS naturalness (all sentences) | ≥ 3.5 / 5 | Robot-sounding TTS harms brand |
| ASR WER (clean audio) | ≤ 15% | Industry standard for production ASR |
| ASR WER (noisy audio) | ≤ 25% | Phone calls are noisy |
| ASR code-switching accuracy | ≥ 80% | BD callers mix Bangla + English |
| TTS first-audio latency | ≤ 400 ms | Sub-second conversational feel |
| End-to-end conversational latency | ≤ 1.5 s | Above 2 s feels broken |
| Reviewer inter-rater reliability (Krippendorff α) | ≥ 0.6 | Evaluation is trustworthy |

## 9. Evaluation report

After evaluation, the audit produces `BANGLA_VOICE_EVALUATION_RESULTS.md` with:

- Per-model scores on each dimension.
- Per-category breakdown (which categories were hardest).
- WER/CER tables for ASR.
- Latency measurements.
- Reviewer comments (anonymized).
- Recommendation: which model(s) to use for Phase 3 production.

The report is delivered to the owner. Owner approval is required before any model is deployed to production callers.

## 10. What this evaluation does NOT do

- Does not download any model until owner approves the evaluation plan.
- Does not record any human voice without explicit written consent.
- Does not use copyrighted text in the corpus.
- Does not publish any reviewer's identity without consent.
- Does not claim a model is "human-like" based on a single reviewer or a single dimension.
- Does not skip the noisy-environment test.
- Does not skip the code-switching test (BD callers frequently mix Bangla + English).

## 11. Owner approval gate

Before the evaluation begins, the owner must:

1. Approve the corpus (100 sentences, 10 categories).
2. Approve the reviewer panel composition (minimum 3 native speakers, regional diversity).
3. Approve the acceptance thresholds (TTS ≥ 4.0 conversational; ASR WER ≤ 15%).
4. Confirm budget for reviewer compensation.
5. Confirm GPU worker availability (or accept CPU-only evaluation, which is slower).
6. Approve the timeline (estimated 2 weeks for full evaluation).

**This evaluation plan does NOT trigger any model download, audio recording, or production deployment.**
