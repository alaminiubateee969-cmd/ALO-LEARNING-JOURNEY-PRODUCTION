# Performance results — 2026-10-18

## No production performance benchmark was run

- No target CPU/RAM inventory or production host access.
- No Ollama model was loaded; no weights downloaded.
- No concurrency/load test, queue test, RAG latency test, p95 response test, or media render benchmark was run.
- The only measured local build/test timing is not representative of production inference capacity.

## Required next measurements

See `docs/research/MODEL_BENCHMARKS.md`. Record host and model revisions, peak RSS, CPU saturation, first-token latency, tokens/sec, p50/p95, bounded concurrent requests, and quality metrics before selecting a model or enabling workers. Do not run 2,000 model processes.
