import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize,
  splitIntoPassages,
  loadPassages,
  retrieve
} from '../src/retrieve.js';

test('tokenize lowercases, strips punctuation, and removes stopwords', () => {
  const tokens = tokenize('What is the price of Quillnote Plus ($8/month)?');
  assert.deepEqual(tokens, ['price', 'quillnote', 'plus', '8', 'month']);
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize('   '), []);
});

test('splitIntoPassages splits markdown into paragraphs and skips standalone headings', () => {
  const md = `# Heading One\n\nFirst paragraph about offline sync.\n\nSecond paragraph about conflict resolution.`;
  const passages = splitIntoPassages(md, 'docs/offline-sync.md');
  assert.equal(passages.length, 2);
  assert.equal(passages[0].docId, 'docs/offline-sync.md');
  assert.match(passages[0].text, /First paragraph/);
  assert.match(passages[1].text, /Second paragraph/);
});

test('loadPassages loads all 10 Quillnote markdown docs', () => {
  const passages = loadPassages();
  const uniqueDocs = new Set(passages.map((p) => p.docId));
  assert.equal(uniqueDocs.size, 10);
  assert.ok(passages.length >= 25);
});

test('retrieve ranks relevant passages highest using BM25', () => {
  const pricingResults = retrieve('How much does the Plus plan cost per month?', 3);
  assert.ok(pricingResults.length > 0);
  assert.equal(pricingResults[0].docId, 'docs/pricing-plans.md');
  assert.ok(pricingResults[0].score >= pricingResults[1].score);
  assert.ok(pricingResults[0].score > 1.2);

  const shortcutResults = retrieve('What keyboard shortcut opens the Quick Switcher Ctrl+K?', 3);
  assert.equal(shortcutResults[0].docId, 'docs/keyboard-shortcuts.md');
  assert.match(shortcutResults[0].text, /Ctrl\+K/);
});

test('retrieve returns score 0 for completely unrelated out-of-scope queries', () => {
  const results = retrieve('What is the boiling point of gold in Celsius?', 3);
  assert.equal(results[0].score, 0);
});

test('retrieve degrades ordering when broken option or BROKEN_RETRIEVAL=1 is active', () => {
  const normal = retrieve('What confirmation phrase must I type to delete my account?', 5);
  const degraded = retrieve('What confirmation phrase must I type to delete my account?', {
    k: 5,
    broken: true
  });
  assert.equal(normal[0].docId, 'docs/account-deletion.md');
  assert.ok(normal[0].score > degraded[0].score);
  assert.equal(degraded[0].score, 0);
});
