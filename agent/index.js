const {env, mcpCall} = require('./mcp.js')
const {qwen} = require('./qwen.js')
const groq = require('./groq.js')
const {curveTypeChecks} = require('./curveType.js')
const {depthArithmeticChecks, depthInconsistencyStatement} = require('./depthArithmetic.js')
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

DEPTH ARITHMETIC CHECK block below is computed directly in code. If it lists any entries, code will overwrite your "headline" and "explanation" afterward with a fixed statement of the inconsistency, so don't spend effort wording that part carefully. Just set verdict to "anomalous" and leave "conflict" null for this station (the check is not a two-source conflict, it's one paper's own numbers not adding up).

Do not generalize to "all stations" or "every reading at this site" unless you have personally checked every row in the GROQ DATA block and they all actually support that claim. A Knowledge Base entry titled something like "high resistivity stations" describes only the entries it contains, a curated subset, not the whole site -- treat its scope as narrow even if its prose reads as a general statement. If you're not certain a claim holds for every station, say it about the specific reading in question instead.

If the question compares two or more numbers (e.g. "which site is higher"), work out the actual numeric comparison silently before writing anything, then state only the final, already-checked conclusion. Never write visible reasoning, self-correction, or phrases like "wait," "let me correct," or "actually" into "headline" or "explanation" -- those fields are the final answer, not a scratchpad. If your first instinct about which number is larger turns out wrong, fix it before you write the JSON, not inside it.

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

// Comparison claims (e.g. "which site is higher") aren't a closed, code-
// computable class the way curve type / table swap / depth arithmetic are,
// so there's no fixed check to hand the model as ground truth here. What IS
// catchable: a held-out test found the model visibly second-guessing itself
// mid-answer ("...2200.9 ohm-m -- wait, no: 2200.9 is higher than 1109.
// Let's correct that..."), landing on a correct explanation while the
// headline, generated earlier, stayed wrong. That visible self-correction
// is itself a reliable signal the first attempt wasn't trustworthy -- one
// bounded retry, same philosophy as the GROQ-query retry.
const SELF_CORRECTION_PATTERN = /\bwait[,.]?\s|let'?s correct|let me (re)?correct|actually,? (that'?s|i'?m|this is) (wrong|incorrect|backwards)/i

function hasVisibleSelfCorrection(answer) {
  return SELF_CORRECTION_PATTERN.test(`${answer.headline || ''} ${answer.explanation || ''}`)
}

async function synthesizeChecked(query, entriesText, groqRows, curveChecks, depthChecks) {
  let answer = await synthesize(query, entriesText, groqRows, curveChecks, depthChecks)
  if (hasVisibleSelfCorrection(answer)) {
    console.error('[agent] synthesized answer contained visible self-correction text, retrying once')
    answer = await synthesize(query, entriesText, groqRows, curveChecks, depthChecks)
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

// The self-correction retry above catches the model visibly doubting
// itself, but a held-out test showed it fails silently just as often: the
// headline flatly claims the wrong direction ("Maakoro-street has higher
// resistivity than Akpoku") while the explanation, computed later, gets it
// right (1109 vs 2201 -- Akpoku is actually higher). No retry trigger fires
// because there's no self-correction text to detect. Comparison claims
// aren't a closed class the way curve type / table swap / depth arithmetic
// are, so there's no pre-computed check to hand the model -- but the
// headline's own claimed direction can be parsed and checked against the
// GROQ data directly, and fixed in code if it's wrong, rather than hoping a
// retry lands on the right answer.
const COMPARISON_PATTERN = /^(.+?)\s+(?:has|shows?|reports?)\s+(higher|greater|more|lower|less|smaller)\b.*?\bthan\s+(.+?)(?:[:.,(]|$)/i

// Detects a comparison QUESTION (not the model's headline -- that's
// COMPARISON_PATTERN above). Found necessary by a held-out regression run:
// "Between Maakoro-street and Akpoku, which has higher resistivity?" names
// Akpoku, which (after the depth-arithmetic tolerance fix started catching
// it) has a real depth-arithmetic issue. applyDepthInconsistencyOverride's
// station-name gate matched on "Akpoku" and overwrote the entire answer
// with the depth-inconsistency template, discarding the comparison the
// question actually asked for even though fixComparisonClaim, just above
// it in the pipeline, had already computed the correct comparison headline.
// A comparison question needs a comparison answer; a station having an
// unrelated documented issue doesn't change what was asked.
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

// Overwrites headline/explanation with the fixed-template statement rather
// than trusting the model to word this consistently -- see depthArithmetic.js
// for why prompt instructions alone weren't reliable enough.
//
// Only fires when there's a real signal the question is ABOUT the matched
// station: either it's the only depth check in scope (an unambiguous single
// candidate), or the question's own wording overlaps that station's name.
// Without this gate, a broad, unscoped question (e.g. "is 1000 ohm-m normal
// for Etche?", no station named) that happens to return a site with several
// depth-arithmetic issues would get silently hijacked into reporting on
// whichever one wins an essentially random tie-break, ignoring the actual
// question and the number the reader asked about. Found via a held-out test.
//
// Also skipped entirely for a comparison question (isComparisonQuestion,
// above), even one that clearly names the matched station -- see that
// function's comment for the second held-out finding this covers.
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
  const answer = await synthesizeChecked(query, entriesText, groqData.rows, curveChecks, depthChecks)
  fixComparisonClaim(answer, groqData.rows)
  enforceGrounding(answer, groqData.rows, curveChecks)
  applyDepthInconsistencyOverride(answer, query, depthChecks)

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

  const requiredKeys = isPublic ? ['SANITY_PROJECT_ID', 'QWEN_API_KEY'] : ['SANITY_MCP_URL', 'SANITY_GROQ_MCP_URL', 'SANITY_KB_ID', 'QWEN_API_KEY']
  const missing = requiredKeys.filter((k) => !env[k])
  if (missing.length > 0) {
    console.error(`Missing keys: ${missing.join(', ')}. See .env.example, or run with --offline.`)
    process.exit(1)
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
    // process.exitCode, not process.exit(): forcing an immediate exit while
    // a fetch's underlying handle hasn't finished closing crashes on
    // Windows with a libuv assertion (src/win/async.c). Setting exitCode
    // lets the event loop drain and exit naturally with the same status.
    process.exitCode = 1
  })
}

module.exports = {ask}
