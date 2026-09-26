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

async function publicSynthesize(query, groqRows, curveChecks) {
  const groqDataText = JSON.stringify(groqRows, null, 2)
  const curveChecksText = JSON.stringify(curveChecks, null, 2)
  const systemPrompt = `You are a VES interpretation assistant running in --public mode: no Knowledge Base access, only the raw GROQ DATA and CURVE TYPE CHECK blocks below, read from the dataset's public query API. Say so plainly if the question needs source-paper prose reasoning you don't have.

Numbers, layer values, and which station/site a reading belongs to come ONLY from the GROQ DATA block. Never invent or adjust a number, and never state a number that isn't present in that block.

If the GROQ data contains two vesReading documents for the same station with different reportedAquiferResistivityOhmM values, that is the disagreement: describe it using each document's sourceLocation field to say where each value came from.

Do NOT build a "conflict" out of a different station's numbers, even one with a similar-sounding name. A conflict's claimA and claimB must both come from documents in the GROQ DATA block for the SAME station this question is about.

CURVE TYPE CHECK is computed directly from the layer numbers in code. For any station where "matches" is false, the paper's own curveTypePublished label does not match its own layer values -- that is itself a source disagreement. Use "derived" as the trusted claim and "published" as the claim to distrust.

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
  const userPrompt = `GROQ DATA (from the public query API):\n${groqDataText}\n\nCURVE TYPE CHECK (computed in code):\n${curveChecksText}\n\nQuestion: ${query}`
  const raw = await qwen(systemPrompt, userPrompt)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Could not parse structured answer from: ${raw}`)
  return JSON.parse(match[0])
}

async function publicAsk(query) {
  console.error('[agent] --public mode: no Sanity token, no Knowledge Base access. Requires the dataset to be public.')
  const groqData = await getPublicGroqData(query)
  const curveChecks = curveTypeChecks(groqData.rows)
  const answer = await publicSynthesize(query, groqData.rows, curveChecks)
  enforceGrounding(answer, groqData.rows, curveChecks)
  answer.groqQuery = groqData.query
  answer.documentIds = groqData.rows.map((r) => r._id)
  return answer
}

module.exports = {publicAsk, publicGroqQuery}
