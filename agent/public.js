// --public mode: no Sanity token needed (the dataset must be set to public
// in the project's dataset visibility settings), but still uses the LLM for
// synthesis -- only the "no token" property applies to the Sanity side, not
// the model side. No Knowledge Base access here (that always needs a
// Context token), so this mode runs the same deterministic site/station
// resolver as --offline instead of an LLM-authored query, then synthesizes
// an answer from GROQ data + the curve-type check alone.
const {env} = require('./mcp.js')
const {qwen} = require('./qwen.js')
const {resolveSiteFromCatalog, buildSiteQuery} = require('./groq.js')
const {curveTypeChecks} = require('./curveType.js')
const {tableSwapChecks} = require('./tableSwap.js')
const {depthArithmeticChecks} = require('./depthArithmetic.js')
const {enforceGrounding} = require('./grounding.js')

const API_VERSION = 'v2024-01-01'

async function publicGroqQuery(query) {
  const url = `https://${env.SANITY_PROJECT_ID}.api.sanity.io/${API_VERSION}/data/query/production?query=${encodeURIComponent(query)}`
  const res = await fetch(url)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(
      `Public query API failed (${res.status}): ${text}\n\nThis mode requires the dataset's visibility to be set to public (Manage -> project -> Datasets).`
    )
  }
  return JSON.parse(text)
}

async function listReadingCatalogPublic() {
  const {result} = await publicGroqQuery('*[_type == "vesReading"]{station, "siteName": site->name}')
  return result
}

async function getPublicGroqData(question) {
  const catalog = await listReadingCatalogPublic()
  const siteName = resolveSiteFromCatalog(question, catalog)
  if (!siteName) {
    throw new Error('Could not resolve a site from the question wording.')
  }
  const query = buildSiteQuery(siteName)
  const {result: rows} = await publicGroqQuery(query)
  return {query, rows: rows || []}
}

async function publicSynthesize(query, groqRows, curveChecks, swapChecks, depthChecks) {
  const groqDataText = JSON.stringify(groqRows, null, 2)
  const curveChecksText = JSON.stringify(curveChecks, null, 2)
  const swapChecksText = JSON.stringify(swapChecks, null, 2)
  const depthChecksText = JSON.stringify(depthChecks, null, 2)
  const systemPrompt = `You are a VES interpretation assistant running in --public mode: no Knowledge Base access, only the raw GROQ DATA, CURVE TYPE CHECK, TABLE SWAP CHECK, and DEPTH ARITHMETIC CHECK blocks below, read from the dataset's public query API. Say so plainly if the question needs source-paper prose reasoning you don't have.

Numbers, layer values, and which station/site a reading belongs to come ONLY from the GROQ DATA block. Never invent or adjust a number, and never state a number that isn't present in that block.

TABLE SWAP CHECK is computed directly in code, not something you should re-derive. For any station listed there, "trustedValue" and "trustedDocumentId" are already resolved -- use them as-is. Do not reason your own way to a different attribution from sourceLocation text; you have gotten this backwards before. Never reassign a value to a different station name than the one on its own document.

Do NOT build a "conflict" out of a different station's numbers, even one with a similar-sounding name. A conflict's claimA and claimB must both come from documents in the GROQ DATA block for the SAME station this question is about.

CURVE TYPE CHECK is computed directly from the layer numbers in code. For any station where "matches" is false, the paper's own curveTypePublished label does not match its own layer values -- that is itself a source disagreement. Use "derived" as the trusted claim and "published" as the claim to distrust.

DEPTH ARITHMETIC CHECK is computed directly in code. Each entry means that layer's printed depth and printed thickness do not reconcile with each other. There is no way to know which of the two printed numbers is the error, only that they disagree. Do NOT put this in the "conflict" object. Do NOT say "the depth is wrong," "the thickness is wrong," "too shallow," "too deep," or "should be X, but the paper says Y," since those imply a winner. In "explanation," state BOTH readings symmetrically using the check's own fields (impliedDepthIfThicknessCorrect and impliedThicknessIfDepthCorrect), and set verdict to "anomalous" because the printed data can't be fully trusted, not because either number is confirmed wrong.

Write for a general audience with NO geology background. Explain any technical term (like "resistivity" or "ohm-m") in plain words the first time you use it.

Reply with ONLY a single JSON object (no markdown fences, no prose outside it), in exactly this shape:
{
  "verdict": "normal" | "anomalous" | "uncertain",
  "headline": "one short plain-English sentence stating the verdict and the single biggest reason why",
  "explanation": "1-2 more plain sentences of context, still jargon-free",
  "conflict": null OR {
    "plainSummary": "one plain sentence describing what's inconsistent",
    "claimA": "short plain description ending in its exact value",
    "claimB": "short plain description ending in its exact value -- must differ from claimA",
    "trusted": "a plain-language restatement of which claim is correct and its value -- never output the literal words 'claimA' or 'claimB'",
    "why": "one plain sentence on why that one is trusted"
  },
  "sources": ["short citation strings"],
  "numbers": [{"label": "short label", "value": "value with unit"}]
}

Set "conflict" to null if the GROQ data shows no disagreement. Every value in "numbers" must literally appear in the GROQ data below.`
  const userPrompt = `GROQ DATA (from the public query API):\n${groqDataText}\n\nCURVE TYPE CHECK (computed in code):\n${curveChecksText}\n\nTABLE SWAP CHECK (computed in code):\n${swapChecksText}\n\nDEPTH ARITHMETIC CHECK (computed in code):\n${depthChecksText}\n\nQuestion: ${query}`
  const raw = await qwen(systemPrompt, userPrompt)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Could not parse structured answer from: ${raw}`)
  return JSON.parse(match[0])
}

function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenOverlap(a, b) {
  const tokensA = new Set(normalize(a).split(' ').filter((t) => t.length > 2))
  const tokensB = normalize(b).split(' ').filter((t) => t.length > 2)
  return tokensB.filter((t) => tokensA.has(t)).length
}

function claimedOhmM(question) {
  const m = String(question).match(/(-?\d+(?:\.\d+)?)\s*ohm-?m/i)
  return m ? parseFloat(m[1]) : null
}

// Even with the rule stated in the prompt, qwen was observed reversing this
// disambiguation repeatedly in testing without the Knowledge Base's
// narrative to lean on. Rather than trust the model's prose reasoning for a
// fact that's mechanically knowable, override the verdict and conflict
// block in code once a table-swap check identifies the relevant station.
function applyTableSwapOverride(answer, question, swapChecks) {
  if (swapChecks.length === 0) return
  let check = swapChecks[0]
  if (swapChecks.length > 1) {
    check = swapChecks.reduce((best, c) => (tokenOverlap(question, c.station) > tokenOverlap(question, best.station) ? c : best))
  }
  if (check.trustedValue === null) return

  const trustedClaim = check.claims.find((c) => c.value === check.trustedValue)
  const untrustedClaim = check.claims.find((c) => c.value !== check.trustedValue)
  const claimed = claimedOhmM(question)

  if (claimed !== null && claimed !== check.trustedValue && claimed !== untrustedClaim?.value) return

  answer.verdict = claimed === null || claimed === check.trustedValue ? 'normal' : 'anomalous'
  answer.conflict = {
    plainSummary: `Two documents report different resistivity values for ${check.station}.`,
    claimA: `${untrustedClaim.value} ohm-m (${untrustedClaim.sourceLocation})`,
    claimB: `${trustedClaim.value} ohm-m (${trustedClaim.sourceLocation})`,
    trusted: `${trustedClaim.value} ohm-m, from ${trustedClaim.sourceLocation}`,
    why: 'that source is not a summary-table row, and every documented swap in this dataset is a summary-table transcription error',
  }
}

async function publicAsk(query) {
  console.error('[agent] --public mode: no Sanity token, no Knowledge Base access. Requires the dataset to be public.')
  const groqData = await getPublicGroqData(query)
  const curveChecks = curveTypeChecks(groqData.rows)
  const swapChecks = tableSwapChecks(groqData.rows)
  const depthChecks = depthArithmeticChecks(groqData.rows)
  const answer = await publicSynthesize(query, groqData.rows, curveChecks, swapChecks, depthChecks)
  applyTableSwapOverride(answer, query, swapChecks)
  enforceGrounding(answer, groqData.rows, curveChecks)
  answer.groqQuery = groqData.query
  answer.documentIds = groqData.rows.map((r) => r._id)
  return answer
}

module.exports = {publicAsk, publicGroqQuery}
