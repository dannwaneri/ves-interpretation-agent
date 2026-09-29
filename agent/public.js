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
const {depthArithmeticChecks, depthInconsistencyStatement} = require('./depthArithmetic.js')
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

DEPTH ARITHMETIC CHECK is computed directly in code. If it lists any entries, code will overwrite your "headline" and "explanation" afterward with a fixed statement of the inconsistency, so don't spend effort wording that part carefully. Just set verdict to "anomalous" and leave "conflict" null for this station.

Write for a general audience with NO geology background. Explain any technical term (like "resistivity" or "ohm-m") in plain words the first time you use it.

If the question compares two or more numbers (e.g. "which site is higher"), work out the actual numeric comparison silently before writing anything, then state only the final, already-checked conclusion. Never write visible reasoning, self-correction, or phrases like "wait," "let me correct," or "actually" into "headline" or "explanation" -- those fields are the final answer, not a scratchpad.

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

// Same bounded-retry safety net as agent/index.js -- see there for why
// (visible self-correction text found in a held-out test is a reliable
// signal the first attempt wasn't trustworthy).
const SELF_CORRECTION_PATTERN = /\bwait[,.]?\s|let'?s correct|let me (re)?correct|actually,? (that'?s|i'?m|this is) (wrong|incorrect|backwards)/i

function hasVisibleSelfCorrection(answer) {
  return SELF_CORRECTION_PATTERN.test(`${answer.headline || ''} ${answer.explanation || ''}`)
}

async function publicSynthesizeChecked(query, groqRows, curveChecks, swapChecks, depthChecks) {
  let answer = await publicSynthesize(query, groqRows, curveChecks, swapChecks, depthChecks)
  if (hasVisibleSelfCorrection(answer)) {
    console.error('[agent] synthesized answer contained visible self-correction text, retrying once')
    answer = await publicSynthesize(query, groqRows, curveChecks, swapChecks, depthChecks)
    if (hasVisibleSelfCorrection(answer)) {
      console.error('[agent] retry also contained visible self-correction text -- shipping as-is, flagged for review')
    }
  }
  return answer
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

// Same comparison-claim fix as agent/index.js -- see there for why (a held-
// out test found the headline flatly wrong on 2/3 repeated runs even after
// the retry-on-visible-self-correction fix, since the error is often silent
// rather than visibly second-guessed).
const COMPARISON_PATTERN = /^(.+?)\s+(?:has|shows?|reports?)\s+(higher|greater|more|lower|less|smaller)\b.*?\bthan\s+(.+?)(?:[:.,(]|$)/i

// Same gate as agent/index.js -- see there for the held-out finding
// (a comparison question naming a station with an unrelated documented
// issue got its whole answer replaced by that issue's fixed template).
// Applies to both overrides below, not just depth arithmetic: table-swap
// has the identical station-name-only gate and the identical exposure.
const COMPARISON_QUESTION_PATTERN = /\bbetween\s+.+\s+and\s+|\bcompare\b|\bcomparing\b|\bversus\b|\bvs\.?\b/i
function isComparisonQuestion(question) {
  return COMPARISON_QUESTION_PATTERN.test(question) || /\bwhich\b.{0,40}\b(higher|lower|greater|less|more|smaller)\b/i.test(question)
}

function fixComparisonClaim(answer, groqRows) {
  const m = (answer.headline || '').match(COMPARISON_PATTERN)
  if (!m) return
  const [, subjectRaw, direction, objectRaw] = m

  const findRow = (raw) => {
    let best = null
    let bestScore = 0
    for (const r of groqRows) {
      if (typeof r.reportedAquiferResistivityOhmM !== 'number') continue
      const score = tokenOverlap(raw, r.station)
      if (score > bestScore) {
        bestScore = score
        best = r
      }
    }
    return best
  }

  const subjectRow = findRow(subjectRaw)
  const objectRow = findRow(objectRaw)
  if (!subjectRow || !objectRow || subjectRow.station === objectRow.station) return

  const subjectVal = subjectRow.reportedAquiferResistivityOhmM
  const objectVal = objectRow.reportedAquiferResistivityOhmM
  const claimsSubjectHigher = /higher|greater|more/i.test(direction)
  const subjectActuallyHigher = subjectVal > objectVal
  if (claimsSubjectHigher === subjectActuallyHigher) return

  console.error(`[agent] correcting a backwards comparison claim in the headline: "${answer.headline}"`)
  const verb = claimsSubjectHigher ? 'higher' : 'lower'
  answer.headline = `${objectRow.station} has ${verb} aquifer resistivity than ${subjectRow.station} (${objectVal} ohm-m vs. ${subjectVal} ohm-m).`
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
  if (isComparisonQuestion(question)) return
  let check = swapChecks[0]
  if (swapChecks.length > 1) {
    check = swapChecks.reduce((best, c) => (tokenOverlap(question, c.station) > tokenOverlap(question, best.station) ? c : best))
    if (tokenOverlap(question, check.station) === 0) return
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

// Same fixed-template override as agent/index.js -- see depthArithmetic.js
// and the relevance-gating comment on the equivalent function in
// agent/index.js for why prompt instructions alone weren't reliable enough
// for this, and why an ungated override on an ambiguous question silently
// hijacked the answer with an unrelated station's finding (found via a
// held-out test).
function applyDepthInconsistencyOverride(answer, question, depthChecks) {
  if (depthChecks.length === 0) return
  if (isComparisonQuestion(question)) return
  let check = depthChecks[0]
  if (depthChecks.length > 1) {
    check = depthChecks.reduce((best, c) => (tokenOverlap(question, c.station) > tokenOverlap(question, best.station) ? c : best))
    if (tokenOverlap(question, check.station) === 0) return
  }

  answer.verdict = 'anomalous'
  answer.headline = `No, ${check.station}'s printed layer ${check.layerIndex} depth and thickness are internally inconsistent.`
  answer.explanation = depthInconsistencyStatement(check)
  answer.conflict = null
}

async function publicAsk(query) {
  console.error('[agent] --public mode: no Sanity token, no Knowledge Base access. Requires the dataset to be public.')
  const groqData = await getPublicGroqData(query)
  const curveChecks = curveTypeChecks(groqData.rows)
  const swapChecks = tableSwapChecks(groqData.rows)
  const depthChecks = depthArithmeticChecks(groqData.rows)
  const answer = await publicSynthesizeChecked(query, groqData.rows, curveChecks, swapChecks, depthChecks)
  fixComparisonClaim(answer, groqData.rows)
  applyTableSwapOverride(answer, query, swapChecks)
  applyDepthInconsistencyOverride(answer, query, depthChecks)
  enforceGrounding(answer, groqData.rows, curveChecks)
  answer.groqQuery = groqData.query
  answer.documentIds = groqData.rows.map((r) => r._id)
  return answer
}

module.exports = {publicAsk, publicGroqQuery}
