# chatbot-eval-harness

[![CI](https://github.com/Tthanh2k6/chatbot-eval-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/Tthanh2k6/chatbot-eval-harness/actions/workflows/ci.yml)

A small support chatbot for a fictional note-taking app (Quillnote) and the QA setup around it: unit tests, a 40-case promptfoo eval, Playwright tests through the real UI, and a CI gate that fails when answer quality drops. It is for QA engineers who want a working example of testing a RAG chatbot without paying for an API. Everything runs offline with a deterministic stub instead of an LLM.

```bash
npm install
npm test                   # 15 node:test unit tests, no network
npm run eval               # 40 promptfoo cases against the stub, fails below 95%
```

## Example: the gate catching a regression

`BROKEN_RETRIEVAL=1` reverses the BM25 ranking on purpose. The same eval then fails (output from CI run 43011960641, 11 Nov 2026):

```
$ npm run eval
Quality Gate Summary: 40/40 tests passed (100.0%). Required threshold: 95.0%.

$ BROKEN_RETRIEVAL=1 npm run eval
Quality Gate Summary: 11/40 tests passed (27.5%). Required threshold: 95.0%.
Quality gate FAILED: pass rate 27.5% is below 95.0%.
```

The `regression-demo` job in `.github/workflows/ci.yml` runs the second command and passes only if it exits non-zero.

## What is in the repo

- `docs/`: 10 short pages (150 to 191 words each) about Quillnote: pricing, offline sync, sharing, export formats, keyboard shortcuts, account deletion, data retention, API rate limits, two-factor auth, refunds.
- `src/retrieve.js`: splits the docs into paragraphs and ranks them with BM25 (k1 = 1.2, b = 0.75).
- `src/answer.js`: `answer(question, passages)` returns `{ text, citations, refused }`. The default stub refuses with "I can only answer questions about Quillnote." when the top score is under 1.2 or when fewer than 34% of the question's terms appear in the top passage. Otherwise it returns up to three matching sentences with a `[docs/<file>.md]` citation and drops injected instructions from the question. If `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set, it calls that provider with `fetch` instead.
- `src/server.js`, `public/index.html`: a `node:http` server on port 3917 (`PORT` overrides it) with the chat page at `/` and `POST /api/chat`.
- `evals/tests.yaml`: 40 cases: 25 factual (checks the fact and the cited file), 8 out-of-scope, 5 prompt-injection, 2 ambiguous.
- `e2e/chat.spec.js`: 6 Playwright tests: labeled input, factual answer with a link to the right doc, refusal, injection, Enter-to-send, empty input.
- `test/`: 15 unit tests for retrieval, the stub answer and the HTTP API.

## Run each suite

| Suite | Command | API key | In CI |
| :--- | :--- | :--- | :--- |
| Unit | `npm test` | no | yes |
| Eval with stub | `npm run eval` | no | yes |
| Playwright | `npx playwright install chromium && npm run e2e` | no | yes |
| Gate regression demo | `BROKEN_RETRIEVAL=1 npm run eval` | no | yes |
| LLM-graded eval | `npx promptfoo eval -c evals/promptfooconfig.llm.yaml --no-cache` | yes | no |

For the LLM-graded run, export `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`), start the server with `npm start` in one terminal and run the promptfoo command in another. That config adds one `llm-rubric` assertion to every case. It has not been run in CI.

## How the gate works

`scripts/run-eval.js` starts the server, runs promptfoo with `-o results.json`, counts passing cases and exits 1 if fewer than 95% pass.

## Limits

- The stub is not an LLM. It picks sentences by keyword overlap, so a green eval says little about a real model.
- Retrieval is lexical. A paraphrase that shares no words with the docs will miss.
- The default evals check facts, citations and refusals with `icontains` and `not-icontains`. They do not judge tone.
- CI runs on Node 22. The package requires Node 20 or newer.

## License

MIT
