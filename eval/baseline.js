// Baseline condition for Phase 4: plain BM25 keyword search over the raw
// extracted text of the three papers, no Sanity Context, no structure.
// Same model, same general answer prompt shape as the structured agent, so
// the comparison isolates what structure (vs. raw keyword retrieval) buys.
const fs = require('fs')
const path = require('path')
const {qwen} = require('../agent/qwen.js')

const PAPER_FILES = {
  bori: 'bori.txt',
  etche: 'etche.txt',
  choba: 'choba.txt',
}

const CHUNK_WORDS = 120
const CHUNK_OVERLAP = 30
const TOP_K = 6

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function chunkText(paper, text) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const chunks = []
  let start = 0
  let idx = 0
  while (start < words.length) {
    const end = Math.min(start + CHUNK_WORDS, words.length)
    const chunkWords = words.slice(start, end)
    chunks.push({paper, chunkIndex: idx, text: chunkWords.join(' ')})
    idx += 1
    if (end === words.length) break
    start = end - CHUNK_OVERLAP
  }
  return chunks
}

function buildCorpus() {
  const chunks = []
  for (const [paper, file] of Object.entries(PAPER_FILES)) {
    const text = fs.readFileSync(path.join(__dirname, 'paper-text', file), 'utf8')
    chunks.push(...chunkText(paper, text))
  }
  return chunks
}

// Standard BM25 (k1=1.5, b=0.75) over the chunk corpus.
function bm25Search(question, corpus, k = TOP_K) {
  const k1 = 1.5
  const b = 0.75
  const docs = corpus.map((c) => tokenize(c.text))
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / docs.length
  const df = new Map()
  for (const d of docs) {
    for (const term of new Set(d)) {
      df.set(term, (df.get(term) || 0) + 1)
    }
  }
  const N = docs.length
  const idf = (term) => Math.log(1 + (N - (df.get(term) || 0) + 0.5) / ((df.get(term) || 0) + 0.5))

  const qTerms = tokenize(question)
  const scores = corpus.map((c, i) => {
    const doc = docs[i]
    const tf = new Map()
    for (const t of doc) tf.set(t, (tf.get(t) || 0) + 1)
    let score = 0
    for (const term of qTerms) {
      const f = tf.get(term) || 0
      if (f === 0) continue
      score += idf(term) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.length) / avgLen)))
    }
    return {...c, score}
  })

  return scores.sort((a, b2) => b2.score - a.score).slice(0, k)
}

function stripFences(raw) {
  return raw
    .trim()
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/```$/, '')
    .trim()
}

async function keywordAnswer(question) {
  const corpus = buildCorpus()
  const retrieved = bm25Search(question, corpus)
  const context = retrieved
    .map((c, i) => `[chunk ${i + 1} -- ${c.paper}.txt, words ~${c.chunkIndex * (CHUNK_WORDS - CHUNK_OVERLAP)}]\n${c.text}`)
    .join('\n\n')

  const systemPrompt = `You are a VES interpretation assistant. Answer ONLY from the retrieved text chunks below, found by plain keyword search (BM25) over the raw paper text. You have no structured data, no cross-references between documents, and no knowledge of which chunks come from the same station or site beyond what the text itself says. Never invent a number, station, or source that is not in the retrieved chunks.

Write for a general audience with NO geology background. Assume the reader has never heard of resistivity or VES surveys. Every sentence must be understandable on first read. If you need a technical term (like "resistivity" or the unit "ohm-m"), briefly explain it in plain words the first time you use it, in parentheses.

Reply with ONLY a single JSON object (no markdown fences, no prose outside it), in exactly this shape:
{
  "verdict": "normal" | "anomalous" | "uncertain",
  "headline": "one short plain-English sentence stating the verdict and the single biggest reason why",
  "explanation": "1-2 more plain sentences of context, still jargon-free",
  "conflict": null OR {
    "plainSummary": "one plain sentence describing what's inconsistent in the source material itself",
    "claimA": "short plain description of the first claim, ending in its exact value",
    "claimB": "short plain description of the second claim, ending in its exact value -- must differ from claimA",
    "trusted": "a plain-language restatement of which claim is correct and its value -- never output the literal words 'claimA' or 'claimB' here",
    "why": "one plain sentence on why that one is trusted"
  },
  "sources": ["short citation strings"],
  "numbers": [{"label": "short label", "value": "value with unit"}]
}

Set "conflict" to null if the retrieved chunks show no disagreement. If the chunks don't contain enough to answer, set verdict to "uncertain" and say so plainly instead of guessing.`
  const userPrompt = `Retrieved chunks:\n${context}\n\nQuestion: ${question}`
  const raw = await qwen(systemPrompt, userPrompt)
  const match = stripFences(raw).match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Could not parse structured answer from: ${raw}`)
  const answer = JSON.parse(match[0])
  answer.retrievedChunks = retrieved.map((c) => ({paper: c.paper, chunkIndex: c.chunkIndex, score: Number(c.score.toFixed(3))}))
  return answer
}

module.exports = {keywordAnswer, buildCorpus, bm25Search}
