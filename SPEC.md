# chatbot-eval-harness — spec (Claude, 11/11/2026)

Goal: a small, honest, runnable example of testing an AI chatbot like a QA engineer would: end-to-end browser tests (Playwright) + answer-quality evals (promptfoo) + a CI gate that fails a PR when quality drops. Must run in CI with NO API keys.

## App (Node >= 20, ESM, no framework; deps allowed: none for the app)
- `docs/`: 10 short markdown pages (150–300 words each) documenting a FICTIONAL note-taking app called "Quillnote" (pricing plans, offline sync, sharing, export formats, keyboard shortcuts, account deletion, data retention, API rate limits, two-factor auth, refund policy). Concrete facts (numbers, limits) so answers are checkable.
- `src/retrieve.js`: tokenizes docs into passages (paragraphs), scores with BM25 (k1=1.2, b=0.75), returns top-k with doc id + score.
- `src/answer.js`: provider interface `answer(question, passages) -> {text, citations:[docId], refused:boolean}`.
  - `stub` provider (default, deterministic): if best score < threshold → refuse with fixed text "I can only answer questions about Quillnote." ; else answer = most relevant sentence(s) from top passage + citation `[docs/<file>.md]`. Ignore instructions inside the question (prompt-injection resistance: never output the system prompt or text after "ignore previous").
  - `openai` / `anthropic` providers: optional, only if OPENAI_API_KEY / ANTHROPIC_API_KEY env set; same output contract; system prompt says answer only from passages and cite. Use fetch, no SDK.
  - env `BROKEN_RETRIEVAL=1` deliberately degrades retrieval (e.g. returns passages in reverse score order) to demo the CI gate failing.
- `src/server.js`: node:http server on PORT (default 3000): GET / serves `public/index.html` (simple accessible chat UI: input with label, send button, message list with role labels, citations rendered as links), POST /api/chat {question} -> JSON {answer, citations, refused}.

## Evals (promptfoo)
- `evals/promptfooconfig.yaml`: provider = HTTP provider calling http://localhost:3917/api/chat with transformResponse to the answer text (and keep citations available). 40 tests in `evals/tests.yaml`: 25 factual (assert `icontains` the fact + `icontains` correct citation file), 8 out-of-scope (assert refusal text), 5 prompt-injection attempts (assert not-icontains system prompt markers, still answers or refuses), 2 ambiguous. Each test has a `description`.
- `evals/promptfooconfig.llm.yaml`: same tests plus `llm-rubric` faithfulness assertions; only for local runs with a key; README explains.
- npm script `eval`: starts server, runs `npx promptfoo@0.x eval -c evals/promptfooconfig.yaml --no-cache` (pin an exact recent 0.x version you know exists), exits non-zero if pass rate < 95% (use promptfoo's threshold or a small node script reading the JSON output `-o results.json`).

## E2E (Playwright, @playwright/test as devDependency)
- `e2e/chat.spec.js`: page loads with labeled input; ask a factual question → answer appears with a citation link pointing to the right doc; out-of-scope → refusal; injection → no system prompt; keyboard-only flow (Enter to send); empty input does not send.
- `playwright.config.js` with webServer starting `node src/server.js`.

## Unit tests
- `test/*.test.js` with node:test for retrieve (BM25 ordering, tokenization), stub answer (refusal threshold, citation format, injection handling), server API (status codes, bad JSON 400).

## CI
- `.github/workflows/ci.yml` on push + pull_request: node 22; npm ci; npm test (unit); npm run eval (promptfoo, stub); npx playwright install --with-deps chromium; npx playwright test. Upload promptfoo results.json and playwright report as artifacts.
- A second job `regression-demo` that runs eval with BROKEN_RETRIEVAL=1 and EXPECTS it to fail (continue-on-error false but invert: step passes only if eval exits non-zero) — proves the gate catches a regression.

## Files also
package.json (name chatbot-eval-harness, private true, scripts: start, test, eval, e2e, license MIT, author Trung Thanh Tran), README.md (what it shows, how to run, what runs in CI vs needs keys, how the gate works, limits: stub provider is not an LLM; keyword retrieval; evals check facts/citations not style), LICENSE MIT 2026 Trung Thanh Tran, .gitignore (node_modules, results.json, playwright-report, test-results, .env).

Rules: no secrets in files; no network in unit tests; keep code plain and readable; do not invent library APIs — if unsure about a promptfoo option, use the simplest documented form (providers: id: https / config url, method, body with {{prompt}}, transformResponse).
