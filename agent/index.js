const {env, mcpCall} = require('./mcp.js')
const {qwen} = require('./qwen.js')
const groq = require('./groq.js')
const {curveTypeChecks} = require('./curveType.js')
const {depthArithmeticChecks} = require('./depthArithmetic.js')
const {enforceGrounding} = require('./grounding.js')

const KB_PATH_LIMIT = 20

async function kbInitialContext() {
  const res = await mcpCall(env.SANITY_MCP_URL, 'initial_context', {})
  const text = res.result?.content?.[0]?.text
  if (!text) throw new Error(`kb_initial_context returned no text: ${JSON.stringify(res)}`)
  return text
}

async function selectPaths(query, outline) {
  const systemPrompt = `You select which entries to read from a VES (Vertical Electrical Sounding) knowledge base outline, given a question. Reply with ONLY a JSON array of entry path strings (from the outline, exactly as written), most relevant first. Pick every entry that could plausibly bear on the question, including source-error / mislabeling entries when the question touches a specific station or site, since those often contain the real answer. Return at most 6 paths. No prose, no markdown, just the JSON array.`
  const userPrompt = `Outline:\n${outline}\n\nQuestion: ${query}\n\nJSON array of entry paths:`
  const raw = await qwen(systemPrompt, userPrompt)
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`Could not parse path selection from: ${raw}`)
  return JSON.parse(match[0])
}

async function readEntries(paths) {
  if (paths.length > KB_PATH_LIMIT) {
    throw new Error(`readEntries: ${paths.length} paths exceeds the ${KB_PATH_LIMIT}-path batch limit`)
  }
  const res = await mcpCall(env.SANITY_MCP_URL, 'knowledge_base_read', {
    knowledgeBase: env.SANITY_KB_ID,
    paths,
  })
  const text = res.result?.content?.[0]?.text
  if (!text) throw new Error(`knowledge_base_read returned no text: ${JSON.stringify(res)}`)
  return text
}

function stripFences(raw) {
  return raw
    .trim()
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/```$/, '')
    .trim()
}

async function writeGroqQuery(question, schemaOutline, catalog) {
  const catalogText = catalog.map((r) => `- station "${r.station}" (site: "${r.siteName}")`).join('\n')
  const systemPrompt = `You write ONE GROQ query for a Sanity dataset. Here is its schema:

${schemaOutline}

Rules:
1. Use == for matching a site or station name, never match. Names contain spaces or are hyphenated, and match does not compare them reliably.
2. Only compare against the exact literal strings given in the candidate list below. Do not reformat, guess casing, or invent a name.
3. Match by site name (site->name == "..."), not by a single station, so the result includes every reading at that site. A verdict about whether one reading is normal needs the other readings at the same site for comparison. Match exactly ONE site, the one the question is actually about -- do not OR multiple sites together unless the question names more than one.
4. Your projection must include at least: _id, station, sourceLocation, curveTypePublished, rmsPercent, layers, reportedAquiferResistivityOhmM, reportedAquiferDepthM, reportedAquiferThicknessM, "siteName": site->name, "paperId": paper._ref, "paperTitle": paper->title, "paperCitation": paper->citation.
5. Do not add [0], first(), or any limit. Return every matching document.

Reply with ONLY the raw GROQ query text. No markdown fences, no prose.`
  const userPrompt = `Candidate stations and their sites:\n${catalogText}\n\nQuestion: ${question}\n\nGROQ query:`
  const raw = await qwen(systemPrompt, userPrompt)
  return stripFences(raw)
}

async function fixGroqQuery(brokenQuery, errorMessage) {
  const systemPrompt = `You fix a broken GROQ query for a Sanity dataset. Use == (not match) for site/station names. Reply with ONLY the corrected GROQ query text, no markdown fences, no prose.`
  const userPrompt = `Query: ${brokenQuery}\nError: ${errorMessage}\n\nCorrected GROQ query:`
  const raw = await qwen(systemPrompt, userPrompt)
  return stripFences(raw)
}

// Numbers only ever come from here: a live GROQ query against the dataset.
// The model gets one shot at writing the query, one bounded retry if it
// errors, and a deterministic code-built fallback if both attempts fail or
// come back empty -- never an open-ended retry loop.
async function getGroqData(question) {
  const [schemaOutline, catalog] = await Promise.all([
    groq.dataInitialContext(),
    groq.listReadingCatalog(),
  ])

  let query = await writeGroqQuery(question, schemaOutline, catalog)
  let source = 'model'
  let rows

  try {
    ;({result: rows} = await groq.runGroqQuery(query))
  } catch (e) {
    console.error(`[agent] model-written GROQ query failed, retrying once: ${e.message}`)
    try {
      query = await fixGroqQuery(query, e.message)
      ;({result: rows} = await groq.runGroqQuery(query))
    } catch (e2) {
      console.error(`[agent] retried GROQ query also failed, falling back to a code-built query: ${e2.message}`)
      const siteName = groq.resolveSiteFromCatalog(question, catalog)
      if (!siteName) {
        throw new Error(
          `Could not resolve a site from the question, and the model's GROQ query failed twice. Last error: ${e2.message}`
        )
      }
      query = groq.buildSiteQuery(siteName)
      source = 'fallback'
      ;({result: rows} = await groq.runGroqQuery(query))
    }
  }

  if (!rows || rows.length === 0) {
    console.error('[agent] GROQ query returned zero rows, retrying with a code-built fallback query')
    const siteName = groq.resolveSiteFromCatalog(question, catalog)
    if (siteName) {
      query = groq.buildSiteQuery(siteName)
      source = 'fallback'
      ;({result: rows} = await groq.runGroqQuery(query))
    }
  }

  return {query, rows: rows || [], source}
}

async function synthesize(query, entriesText, groqRows, curveChecks, depthChecks) {
  const groqDataText = JSON.stringify(groqRows, null, 2)
  const curveChecksText = JSON.stringify(curveChecks, null, 2)
  const depthChecksText = JSON.stringify(depthChecks, null, 2)
  const systemPrompt = `You are a VES interpretation assistant.

Numbers, layer values, and which station/site a reading belongs to come ONLY from the GROQ DATA block below, read live from the dataset. Never invent or adjust a number, and never state a number that isn't present in that block.

Explanations, plain-language reasoning, and the "why" behind any source disagreement come ONLY from the KNOWLEDGE BASE ENTRIES block. Never invent a source or a conflict that isn't shown there.

If the GROQ data contains two vesReading documents for the same station with different reportedAquiferResistivityOhmM values, that is the disagreement: describe it using each document's sourceLocation field to say where each value came from.

Do NOT build a "conflict" out of a different station's numbers, even one with a similar-sounding name (e.g. "Kenpoly Convocation Arena" is not "Kenpoly sec school field" -- they are different stations with different data, do not merge them). A conflict's claimA and claimB must both come from documents in the GROQ DATA block for the SAME station this question is about. If the GROQ data contains only one document for that station and the CURVE TYPE CHECK shows no mismatch, set "conflict" to null -- there is nothing to compare it against, however similar another station's documented issue might sound.

CURVE TYPE CHECK block below is computed directly from the layer numbers in code, not read from prose and not something you should re-derive yourself. For any station where "matches" is false, the paper's own curveTypePublished label does not match what its own layer values actually do -- that is itself a source disagreement (a label contradicting its own data). Use "derived" as the trusted claim and "published" as the claim to distrust, and explain why using the specific layer where the trend breaks (read the resistivity values in order from the GROQ DATA block to name it, e.g. "the third layer drops instead of rising"). Only raise this as the "conflict" if the question is actually about that station's curve type.

DEPTH ARITHMETIC CHECK block below is computed directly in code. Each entry means that layer's printed depth and printed thickness do not reconcile with each other (prior depth + thickness != printed depth). This is DIFFERENT from the curve-type and table-swap cases: there is no way to determine which of the two printed numbers is the error, only that they disagree. Do NOT put this in the "conflict" object (which requires naming a trusted claim). Do NOT say "the depth is wrong," "the thickness is wrong," "too shallow," "too deep," or use "should be X, but the paper says Y" phrasing, since all of those imply one number is trusted over the other. Instead, in "explanation," state BOTH readings symmetrically using the check's own fields: "if the printed thickness is right, the depth should be impliedDepthIfThicknessCorrect" AND "if the printed depth is right, the thickness should be impliedThicknessIfDepthCorrect" -- give both, not just one, and set verdict to "anomalous" because the printed data can't be fully trusted, not because you've concluded either number is definitely wrong.

Do not generalize to "all stations" or "every reading at this site" unless you have personally checked every row in the GROQ DATA block and they all actually support that claim. A Knowledge Base entry titled something like "high resistivity stations" describes only the entries it contains, a curated subset, not the whole site -- treat its scope as narrow even if its prose reads as a general statement. If you're not certain a claim holds for every station, say it about the specific reading in question instead.

Write for a general audience with NO geology background. Assume the reader has never heard of resistivity or VES surveys. Every sentence must be understandable on first read. If you need a technical term (like "resistivity" or the unit "ohm-m"), briefly explain it in plain words the first time you use it, in parentheses.

Reply with ONLY a single JSON object (no markdown fences, no prose outside it), in exactly this shape:
{
  "verdict": "normal" | "anomalous" | "uncertain",
  "headline": "one short plain-English sentence stating the verdict and the single biggest reason why, something a 10-year-old could follow",
  "explanation": "1-2 more plain sentences of context, still jargon-free",
  "conflict": null OR {
    "plainSummary": "one plain sentence describing what's inconsistent in the source material itself",
    "claimA": "short plain description of the first claim, ending in its exact value, e.g. 'p.7 summary table row labeled BMGS bori field says 3706 ohm-m'",
    "claimB": "short plain description of the second claim, ending in its exact value -- claimA and claimB must state two DIFFERENT values, never the same number twice",
    "trusted": "a plain-language restatement of which claim is correct and its value, e.g. 'the coordinate table and figure caption, which say 2950 ohm-m' -- never output the literal words 'claimA' or 'claimB' here",
    "why": "one plain sentence on why that one is trusted"
  },
  "sources": ["short citation strings, e.g. 'Menegbo et al. (2024), Table 1, p.7'"],
  "numbers": [{"label": "short label", "value": "value with unit"}]
}

Set "conflict" to null if the GROQ data shows no disagreement. If there isn't enough data to answer, set verdict to "uncertain" and say so plainly in headline/explanation instead of guessing. Before answering, double-check that claimA and claimB genuinely disagree (different values) -- if you can't find two different values, set "conflict" to null instead of fabricating a disagreement. Every value in "numbers" must be a number that literally appears in the GROQ data below.`
  const userPrompt = `GROQ DATA (from groq_query, live from the dataset):\n${groqDataText}\n\nCURVE TYPE CHECK (computed in code from the layer values above):\n${curveChecksText}\n\nDEPTH ARITHMETIC CHECK (computed in code from the layer values above):\n${depthChecksText}\n\nKNOWLEDGE BASE ENTRIES (from knowledge_base_read):\n${entriesText}\n\nQuestion: ${query}`
  const raw = await qwen(systemPrompt, userPrompt)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Could not parse structured answer from: ${raw}`)
  return JSON.parse(match[0])
}

async function ask(query) {
  const [kbOutline, groqData] = await Promise.all([kbInitialContext(), getGroqData(query)])

  const paths = await selectPaths(query, kbOutline)
  console.error(`[agent] selected KB entries: ${paths.join(', ')}`)
  console.error(`[agent] GROQ query (${groqData.source}): ${groqData.query}`)

  const curveChecks = curveTypeChecks(groqData.rows)
  const mismatches = curveChecks.filter((c) => c.matches === false)
  if (mismatches.length > 0) {
    console.error(
      `[agent] curve type mismatch: ${mismatches.map((m) => `${m.station} published=${m.published} derived=${m.derived}`).join(', ')}`
    )
  }

  const depthChecks = depthArithmeticChecks(groqData.rows)
  if (depthChecks.length > 0) {
    console.error(
      `[agent] depth arithmetic inconsistency: ${depthChecks.map((d) => `${d.station} layer ${d.layerIndex}`).join(', ')}`
    )
  }

  const entriesText = await readEntries(paths)
  const answer = await synthesize(query, entriesText, groqData.rows, curveChecks, depthChecks)
  enforceGrounding(answer, groqData.rows, curveChecks)

  answer.groqQuery = groqData.query
  answer.documentIds = groqData.rows.map((r) => r._id)
  return answer
}

function formatForCli(answer) {
  const badge = {normal: 'NORMAL', anomalous: 'ANOMALOUS', uncertain: 'UNCERTAIN'}[answer.verdict] || answer.verdict.toUpperCase()
  let out = `[${badge}] ${answer.headline}\n\n${answer.explanation}\n`
  if (answer.conflict) {
    out += `\nSOURCE DISAGREEMENT FOUND:\n  ${answer.conflict.plainSummary}\n  Claim A: ${answer.conflict.claimA}\n  Claim B: ${answer.conflict.claimB}\n  Trusted: ${answer.conflict.trusted} (${answer.conflict.why})\n`
  }
  out += `\nSources:\n${answer.sources.map((s) => `  - ${s}`).join('\n')}\n`
  out += `\nNumbers:\n${answer.numbers.map((n) => `  - ${n.label}: ${n.value}`).join('\n')}\n`
  out += `\nGROQ query run:\n  ${answer.groqQuery}\n`
  out += `\nDocument IDs used:\n${answer.documentIds.map((id) => `  - ${id}`).join('\n')}\n`
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const offline = args.includes('--offline')
  const isPublic = args.includes('--public')
  const query = args.filter((a) => a !== '--offline' && a !== '--public').join(' ')

  if (!query) {
    console.error('Usage: node agent/index.js ["--offline" | "--public"] "your question"')
    process.exit(1)
  }
  if (offline && isPublic) {
    console.error('Pass only one of --offline or --public, not both.')
    process.exit(1)
  }

  if (offline) {
    const {offlineAsk, formatForCli: formatOffline} = require('./offline.js')
    const answer = await offlineAsk(query)
    console.log('\n' + formatOffline(answer))
    return
  }
  if (isPublic) {
    const {publicAsk} = require('./public.js')
    const answer = await publicAsk(query)
    console.log('\n' + formatForCli(answer))
    return
  }

  const answer = await ask(query)
  console.log('\n' + formatForCli(answer))
}

if (require.main === module) {
  main().catch((e) => {
    console.error('FATAL:', e.message)
    process.exit(1)
  })
}

module.exports = {ask}
