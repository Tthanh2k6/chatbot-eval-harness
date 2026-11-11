import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { REFUSAL_TEXT } from '../src/answer.js';

async function withTestServer(fn) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET / serves accessible HTML chat UI with 200 status', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    const html = await res.text();
    assert.match(html, /<label[^>]*for="question-input"/);
    assert.match(html, /id="question-input"/);
  });
});

test('POST /api/chat returns 200 with answer and citations for factual question', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'How many days are deleted notes retained in the Trash folder on the Free plan?'
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.refused, false);
    assert.match(body.answer, /30 days/);
    assert.match(body.answer, /\[docs\/data-retention\.md\]/);
    assert.deepEqual(body.citations, ['docs/data-retention.md']);
  });
});

test('POST /api/chat refuses out-of-scope questions with 200 and refused=true', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'How do I bake a sourdough bread loaf at home?'
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.refused, true);
    assert.equal(body.answer, REFUSAL_TEXT);
    assert.deepEqual(body.citations, []);
  });
});

test('POST /api/chat returns 400 on bad JSON or empty question', async () => {
  await withTestServer(async (baseUrl) => {
    const badJsonRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json'
    });
    assert.equal(badJsonRes.status, 400);

    const emptyQRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '   ' })
    });
    assert.equal(emptyQRes.status, 400);
  });
});

test('GET unknown route returns 404', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(res.status, 404);
  });
});
