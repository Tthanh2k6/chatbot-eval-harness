import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DOCS_DIR = path.resolve(__dirname, '..', 'docs');

export const BM25_K1 = 1.2;
export const BM25_B = 0.75;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'to',
  'for', 'with', 'on', 'at', 'from', 'by', 'about', 'as', 'into', 'like',
  'through', 'after', 'over', 'between', 'out', 'against', 'during',
  'without', 'before', 'under', 'around', 'among', 'what', 'which', 'who',
  'whom', 'this', 'that', 'these', 'those', 'am', 'i', 'me', 'my', 'we',
  'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its',
  'they', 'them', 'their', 'and', 'but', 'if', 'or', 'because', 'until',
  'while', 'how', 'where', 'when', 'why', 'please', 'tell', 'also', 'any'
]);

/**
 * Strips prompt-injection tails such as "ignore previous instructions..."
 */
export function stripInjectionFromQuery(text) {
  if (typeof text !== 'string') return '';
  let cleaned = text.replace(
    /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|earlier)\b[\s\S]*/i,
    ''
  );
  cleaned = cleaned.replace(
    /\b(reveal|print|output|show|repeat)\s+(your\s+|the\s+)?(hidden\s+|secret\s+|full\s+)?(system\s+prompt|developer\s+rules|instructions)\b[\s\S]*/i,
    ''
  );
  return cleaned.trim();
}

/**
 * Light stemmer for matching simple English inflections (plurals, -ed, -ing).
 */
export function stemToken(token) {
  if (token.length <= 3) return token;
  if (token.endsWith('ies') && token.length > 4) {
    return token.slice(0, -3) + 'y';
  }
  if (token.endsWith('ing') && token.length > 5) {
    return token.slice(0, -3);
  }
  if (token.endsWith('ed') && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith('es') && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

/**
 * Tokenizes input text into lowercase alphanumeric content words.
 */
export function tokenize(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

/**
 * Splits a markdown document into paragraph passages, ignoring standalone headings.
 */
export function splitIntoPassages(markdown, docId) {
  if (typeof markdown !== 'string') return [];
  return markdown
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !/^#+\s+[^\r\n]+$/.test(block))
    .map((block) => ({
      docId,
      text: block.replace(/^#+\s+[^\r\n]+\r?\n+/, '').trim()
    }))
    .filter((p) => p.text.length > 0);
}

let cachedDefaultPassages = null;

/**
 * Loads and splits all markdown files from docsDir into passages.
 */
export function loadPassages(docsDir = DEFAULT_DOCS_DIR) {
  if (docsDir === DEFAULT_DOCS_DIR && cachedDefaultPassages) {
    return cachedDefaultPassages;
  }
  if (!fs.existsSync(docsDir)) {
    return [];
  }
  const files = fs
    .readdirSync(docsDir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  const passages = [];
  for (const file of files) {
    const fullPath = path.join(docsDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const docId = `docs/${file}`;
    passages.push(...splitIntoPassages(content, docId));
  }

  if (docsDir === DEFAULT_DOCS_DIR) {
    cachedDefaultPassages = passages;
  }
  return passages;
}

/**
 * Retrieves top-k passages scored using BM25 (k1=1.2, b=0.75).
 */
export function retrieve(query, kOrOptions = 5) {
  let k = 5;
  let customPassages = null;
  let docsDir = DEFAULT_DOCS_DIR;
  let broken = process.env.BROKEN_RETRIEVAL === '1';

  if (typeof kOrOptions === 'number') {
    k = kOrOptions;
  } else if (kOrOptions && typeof kOrOptions === 'object') {
    if (typeof kOrOptions.k === 'number') k = kOrOptions.k;
    if (Array.isArray(kOrOptions.passages)) customPassages = kOrOptions.passages;
    if (typeof kOrOptions.docsDir === 'string') docsDir = kOrOptions.docsDir;
    if (typeof kOrOptions.broken === 'boolean') broken = kOrOptions.broken;
  }

  const rawPassages = customPassages || loadPassages(docsDir);
  if (rawPassages.length === 0) return [];

  const sanitizedQuery = stripInjectionFromQuery(query);
  const queryTokens = tokenize(sanitizedQuery);
  const uniqueQueryStems = [...new Set(queryTokens.map(stemToken))];

  const N = rawPassages.length;
  const tokenizedPassages = rawPassages.map((p) => {
    const tokens = tokenize(p.text);
    const stems = tokens.map(stemToken);
    const termFreq = new Map();
    for (const s of stems) {
      termFreq.set(s, (termFreq.get(s) || 0) + 1);
    }
    return {
      docId: p.docId,
      text: p.text,
      length: stems.length,
      termFreq
    };
  });

  const totalLength = tokenizedPassages.reduce((sum, p) => sum + p.length, 0);
  const avgdl = N > 0 && totalLength > 0 ? totalLength / N : 1;

  // Document frequency per unique query stem
  const docFreq = new Map();
  for (const qStem of uniqueQueryStems) {
    let df = 0;
    for (const p of tokenizedPassages) {
      if (p.termFreq.has(qStem)) df += 1;
    }
    docFreq.set(qStem, df);
  }

  const scored = tokenizedPassages.map((p, index) => {
    let score = 0;
    if (uniqueQueryStems.length > 0 && p.length > 0) {
      for (const qStem of uniqueQueryStems) {
        const tf = p.termFreq.get(qStem) || 0;
        if (tf === 0) continue;
        const df = docFreq.get(qStem) || 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const norm = tf + BM25_K1 * (1 - BM25_B + BM25_B * (p.length / avgdl));
        score += idf * ((tf * (BM25_K1 + 1)) / norm);
      }
    }
    return {
      docId: p.docId,
      text: p.text,
      score: Number(score.toFixed(6)),
      _index: index
    };
  });

  if (broken) {
    // Deliberately degrade retrieval by sorting in reverse score order (lowest first)
    scored.sort((a, b) => a.score - b.score || b._index - a._index);
  } else {
    scored.sort((a, b) => b.score - a.score || a._index - b._index);
  }

  return scored.slice(0, k).map(({ docId, text, score }) => ({
    docId,
    text,
    score
  }));
}
