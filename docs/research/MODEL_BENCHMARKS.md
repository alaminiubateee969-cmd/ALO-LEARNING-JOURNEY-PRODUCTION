# Model benchmark status — 2026-10-18

## Result: NOT RUN

No model weights were downloaded, no Ollama/llama.cpp/Transformers service was available to benchmark in this checkout, and no actual production host CPU/RAM inventory was obtained. Therefore there are no defensible latency, throughput, memory, Bangla-quality, JSON, RAG, or prompt-injection benchmark numbers. Do not treat model names in `.env.example`, docs, or UI as evidence of a deployed model.

## CPU-first shortlist for a future controlled test

| Candidate | License/weights status | CPU/RAM status | Decision |
|---|---|---|---|
| Qwen 1.5B instruct family | Model card and exact weight revision/license must be checked for the exact artifact. | Not measured. | Candidate only. |
| Qwen 3B instruct family | Exact model card, quantization, and use terms must be checked. | Not measured. | Candidate only. |
| Qwen 7B quantized | Exact artifact/quantization/checksum and license must be verified. | Likely requires substantially more RAM; actual host capacity unknown. | Do not install until host inventory and a memory benchmark. |
| Small multilingual embedding model | Select only after embedding license/quality comparison. | Not measured. | Candidate only. |

## Benchmark protocol (must be completed on target host)

1. Record CPU model/cores, RAM, swap, disk free space, OS, kernel, Node/Python versions and concurrent service memory.
2. Pin model repository/revision, quantization and checksum; verify code license and model-weight license separately.
3. Load one model at a time; record peak RSS and startup/first-token time.
4. Run at least 200 benchmark questions, with an isolated test set covering Bangla, English, CRM summaries, education facts, tool selection, missing evidence, JSON schema, and prompt injection.
5. Measure p50/p95 first-token and total latency, tokens/sec, JSON schema validity, factuality/citation correctness and refusal behavior.
6. Compare against a fixed baseline and publish raw anonymized test results; do not train on held-out test data.
7. Stop if memory pressure harms the CRM, DB, or web app; set bounded concurrency before enabling shared service.

## Acceptance thresholds

Thresholds are not set until product owners select latency/quality targets. No candidate can be selected from this report. RAG must cite retrieved sources and clearly abstain when evidence is absent. Tool arguments must pass a strict schema and policy gate. Model output is never itself permission to execute tools.

## Fine-tuning

No CPU LoRA/QLoRA feasibility has been measured. Do not promise fine-tuning on CPU. First ship RAG and evaluation; only test parameter-efficient fine-tuning on approved, anonymized data if target hardware supports it. Preserve a baseline, held-out tests, adapter provenance and rollback.
