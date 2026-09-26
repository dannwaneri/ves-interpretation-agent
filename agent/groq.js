const {env, mcpCall} = require('./mcp.js')

const READING_PROJECTION = `{
  _id,
  station,
  sourceLocation,
  curveTypePublished,
  rmsPercent,
  layers,
  reportedAquiferResistivityOhmM,
  reportedAquiferDepthM,
  reportedAquiferThicknessM,
  transcriptionNote,
  "siteName": site->name,
  "paperId": paper._ref,
  "paperTitle": paper->title,
  "paperCitation": paper->citation
}`

async function dataInitialContext() {
  const res = await mcpCall(env.SANITY_GROQ_MCP_URL, 'initial_context', {})
  const text = res.result?.content?.[0]?.text
  if (!text) throw new Error(`data_initial_context returned no text: ${JSON.stringify(res)}`)
  return text
}

async function runGroqQuery(query) {
  const res = await mcpCall(env.SANITY_GROQ_MCP_URL, 'groq_query', {query})
  const text = res.result?.content?.[0]?.text
  if (!text) throw new Error(`groq_query returned no text: ${JSON.stringify(res)}`)
  const parsed = JSON.parse(text)
  if (res.result?.isError || parsed.error) {
    const err = new Error(parsed.message || 'groq_query failed')
    err.groqError = parsed
    throw err
  }
  return parsed // {meta: {...}, result: [...]}
}

// Small (~30 docs), cheap catalog of every station/site name that actually
// exists, so site-name resolution can use == against a real literal instead
// of guessing how the question's wording maps onto the stored form.
async function listReadingCatalog() {
  const {result} = await runGroqQuery(
    '*[_type == "vesReading"]{_id, station, "siteName": site->name}'
  )
  return result
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

// Deterministic fallback: score every known site by how much its own name
// and its stations' names overlap with the question's wording, no LLM
// involved. Used only when the model's own GROQ attempt fails or returns
// nothing, so there's always a query that actually runs.
function resolveSiteFromCatalog(question, catalog) {
  const bySite = new Map()
  for (const r of catalog) {
    if (!bySite.has(r.siteName)) bySite.set(r.siteName, [])
    bySite.get(r.siteName).push(r.station)
  }
  let best = null
  let bestScore = 0
  for (const [siteName, stations] of bySite) {
    const siteScore = tokenOverlap(question, siteName)
    const stationScore = Math.max(0, ...stations.map((s) => tokenOverlap(question, s)))
    const score = siteScore + stationScore
    if (score > bestScore) {
      bestScore = score
      best = siteName
    }
  }
  return bestScore > 0 ? best : null
}

function buildSiteQuery(siteName) {
  const escaped = siteName.replace(/"/g, '\\"')
  return `*[_type == "vesReading" && site->name == "${escaped}"]${READING_PROJECTION}`
}

module.exports = {
  dataInitialContext,
  runGroqQuery,
  listReadingCatalog,
  resolveSiteFromCatalog,
  buildSiteQuery,
  READING_PROJECTION,
}
