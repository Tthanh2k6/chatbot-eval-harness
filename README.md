# chatbot-eval-harness

A small, runnable reference implementation demonstrating how a QA engineer tests a retrieval-augmented generation (RAG) documentation chatbot across three layers:

1. **Unit tests (`node:test`)** — fast, zero-network checks for BM25 passage retrieval, deterministic answer generation, prompt-injection stripping, and HTTP API validation.
2. **Answer-quality evaluations (`promptfoo`)** — a 40-case evaluation suite covering factual accuracy + source citations (25 tests), out-of-scope refusals (8 tests), prompt-injection resistance (5 tests), and ambiguous questions (2 tests).
3. **Browser E2E tests (`@playwright/test`)** — full accessibility, citation-link, refusal, prompt-injection, keyboard-only (`Enter` to submit), and empty-input guards against the live web UI.

---

## Architecture Overview

- **`docs/`**: 10 Markdown documentation pages (150–300 words each) for a fictional note-taking app called **Quillnote** (`pricing-plans.md`, `offline-sync.md`, `sharing.md`, `export-formats.md`, `keyboard-shortcuts.md`, `account-deletion.md`, `data-retention.md`, `api-rate-limits.md`, `two-factor-auth.md`, `refund-policy.md`).
- **`src/retrieve.js`**: Splits Markdown docs into paragraph passages and ranks them with **BM25** (`k1 = 1.2`, `b = 0.75`). Setting `BROKEN_RETRIEVAL=1` reverses the score order to intentionally simulate a retrieval regression.
- **`src/answer.js`**: Exposes `answer(question, passages) -> { text, citations: [docId], refused: boolean }`:
  - **`stub` provider (default, deterministic, no API keys)**: Refuses with `"I can only answer questions about Quillnote."` when the top BM25 score is below threshold (`1.2`), or extracts the most relevant sentence(s) from the top passage with a `[docs/<file>.md]` citation while stripping prompt-injection instructions.
  - **`openai` / `anthropic` providers (optional)**: Used automatically when `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set in the environment (`fetch`-based, zero SDK dependencies).
- **`src/server.js` & `public/index.html`**: Zero-dependency `node:http` server on `PORT` (default `3000`) serving the accessible chat UI at `GET /` and answering questions at `POST /api/chat`.

---


## Measured results (local run, 11 November 2026, Windows 11, Node 24, promptfoo 0.125.1)

| Check | Result |
| :--- | :--- |
| Unit tests (`npm test`) | 15/15 pass |
| Eval gate, normal retrieval (`npm run eval`) | 40/40 (100%), gate passes |
| Eval gate, `BROKEN_RETRIEVAL=1` | 11/40 (27.5%), gate fails with exit 1 |
| Playwright (`npx playwright test`) | 6/6 pass |

The first eval run of the stub scored 37/40: two out-of-scope questions ("reverse a singly linked list", "moons of Jupiter") were answered from unrelated pages because one shared word gave a high enough BM25 score, and a 2FA answer dropped the sentence about TOTP apps. The stub now refuses when under a third of the question's terms appear in the top passage, and it returns up to three matching sentences. That is the kind of regression this harness is meant to catch.

The default port is 3917 (set `PORT` to change it); 3000 was taken by another local service on the machine this was built on.

## Quick Start

Requires **Node.js >= 20** (tested on Node 22).

```bash
# 1. Install devDependencies (@playwright/test)
npm install

# 2. Run unit tests (node --test)
npm test

# 3. Start the chat server on http://localhost:3917
npm start

# 4. Run the 40-test promptfoo evaluation suite + 95% quality gate
npm run eval

# 5. Run Playwright E2E browser tests
npx playwright install chromium
npm run e2e
```

---

## What Runs in CI vs. What Needs API Keys

| Suite | Command | Needs API Keys? | Runs in GitHub Actions CI? |
| :--- | :--- | :--- | :--- |
| Unit tests | `npm test` | No | Yes |
| Deterministic evals (`evals/promptfooconfig.yaml`) | `npm run eval` | No (uses `stub` provider) | Yes |
| Regression gate demo (`BROKEN_RETRIEVAL=1`) | `BROKEN_RETRIEVAL=1 npm run eval` | No | Yes (`regression-demo` job) |
| Playwright E2E (`e2e/chat.spec.js`) | `npm run e2e` | No | Yes |
| LLM-graded faithfulness (`evals/promptfooconfig.llm.yaml`) | `npx promptfoo eval -c evals/promptfooconfig.llm.yaml --no-cache` | Yes (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) | Local only |

### Running with Live LLM Providers Locally

To evaluate live LLM answers and `llm-rubric` faithfulness assertions locally:

```bash
export OPENAI_API_KEY="sk-..."
# Start server with OpenAI provider enabled
npm start

# In another terminal, run the LLM-rubric promptfoo config
npx promptfoo eval -c evals/promptfooconfig.llm.yaml --no-cache
```

---

## How the CI Quality Gate Works

1. `npm run eval` (`scripts/run-eval.js`) boots the local HTTP server, runs `npx promptfoo eval -c evals/promptfooconfig.yaml --no-cache -o results.json`, and inspects `results.json`.
2. If the pass rate across the 40 test cases is **below 95%**, `scripts/run-eval.js` exits with code `1`, failing the PR build.
3. In `.github/workflows/ci.yml`, the second job (`regression-demo`) runs `BROKEN_RETRIEVAL=1 npm run eval` and asserts that the command **exits non-zero**, proving that the evaluation gate actively catches a retrieval regression.

---

## Honest Limitations

- **Stub provider is not an LLM**: The default `stub` provider selects top-scoring sentences deterministically from retrieved paragraphs rather than synthesizing prose with a neural language model.
- **Keyword retrieval**: BM25 relies on lexical token overlap (`k1=1.2, b=0.75`); paraphrases that share zero keywords with the documentation require semantic embeddings to match.
- **Deterministic evals check facts and citations, not style**: The CI `icontains` / `not-icontains` assertions verify concrete numbers, limits, citations, refusals, and prompt-injection safety, whereas tone and nuanced faithfulness require `evals/promptfooconfig.llm.yaml` with an API key.
