// --offline mode: no network at all, not even the LLM. Loads a local
// dataset snapshot (agent/offline-snapshot.ndjson, refreshed via
// scripts/refresh-offline-snapshot.sh) and answers with the SAME GROQ query
// text buildSiteQuery() produces for the online agent, executed locally by
// groq-js instead of the live MCP endpoint. The verdict is rule-based, not
// LLM-synthesized: normal, anomalous, or label mismatch.
const fs = require('fs')
const path = require('path')
const {parse, evaluateSync} = require('groq-js')
const {checkLabel} = require('./curveType.js')
const {checkDepthArithmetic} = require('./depthArithmetic.js')
const {resolveSiteFromCatalog, buildSiteQuery} = require('./groq.js')

const SNAPSHOT_PATH = path.join(__dirname, 'offline-snapshot.ndjson')

function loadSnapshot() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    throw new Error(
      `No offline snapshot at ${SNAPSHOT_PATH}. Run scripts/refresh-offline-snapshot.sh first (needs a one-time Sanity login).`
    )
  }
  return fs
    .readFileSync(SNAPSHOT_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

async function runLocalGroq(query, dataset) {
  const tree = parse(query)
  return evaluateSync(tree, {dataset}).get()
}

function buildCatalog(dataset) {
  const sites = new Map(dataset.filter((d) => d._type === 'surveySite').map((d) => [d._id, d]))
  return dataset
    .filter((d) => d._type === 'vesReading')
    .map((r) => ({station: r.station, siteName: sites.get(r.site?._ref)?.name}))
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

// Which station, among the readings at the resolved site, is the question
// actually about. Ties (e.g. two documents sharing the same station name --
// the table-swap case) are kept together, not arbitrarily broken.
function resolveStation(question, rows) {
  let bestScore = -1
  let bestStation = null
  for (const r of rows) {
    const score = tokenOverlap(question, r.station)
    if (score > bestScore) {
      bestScore = score
      bestStation = r.station
    }
  }
  if (bestStation === null) return rows
  return rows.filter((r) => r.station === bestStation)
}

function citation(row) {
  return `${row.paperTitle || row.paperCitation}, ${row.sourceLocation}`
}

// Extracts a resistivity value the question itself claims (e.g. "I got a
// 2950 ohm-m reading"), so the rule engine can tell whether the reader's
// own number is the trusted one, not just that the station has some known
// disagreement.
function claimedOhmM(question) {
  const m = String(question).match(/(-?\d+(?:\.\d+)?)\s*ohm-?m/i)
  return m ? parseFloat(m[1]) : null
}

// Rule-based, not LLM-synthesized: normal / anomalous / label mismatch.
function ruleBasedAnswer(question, rows) {
  const stationRows = resolveStation(question, rows)

  if (stationRows.length > 1) {
    const values = new Set(stationRows.map((r) => r.reportedAquiferResistivityOhmM))
    if (values.size > 1) {
      // Same station, two disagreeing documents -- the table-swap pattern.
      // Rule (not a model judgment): prefer the reading whose sourceLocation
      // is NOT a summary-table row, since every documented swap in this
      // dataset is a summary-table transcription error against the paper's
      // own figures/coordinate table.
      const preferred = stationRows.filter((r) => !/summary table/i.test(r.sourceLocation))
      const trusted = preferred.length === 1 ? preferred[0] : null
      const claimed = claimedOhmM(question)
      // A reader's own number is "normal" if it happens to be the trusted
      // one -- the disagreement is real, but their specific reading checks
      // out. If it matches the untrusted value instead, say so plainly.
      const verdict = trusted && claimed === trusted.reportedAquiferResistivityOhmM ? 'normal' : 'anomalous'
      let summary
      if (!trusted) {
        summary = `Two documents disagree on this station's resistivity and the rule could not pick one (both or neither are summary-table rows).`
      } else if (claimed === trusted.reportedAquiferResistivityOhmM) {
        summary = `Your reading (${claimed} ohm-m) matches the trusted source. A different part of the same paper (rule: a summary-table row) disagrees, but that row is the one that's wrong.`
      } else if (claimed !== null) {
        summary = `Your reading (${claimed} ohm-m) matches the source that's actually wrong here (rule: a summary-table row). The trusted value, from the paper's own figure/coordinate table, is ${trusted.reportedAquiferResistivityOhmM} ohm-m.`
      } else {
        summary = `Two documents disagree on this station's resistivity. Trusted (rule: prefer non-summary-table source): ${trusted.reportedAquiferResistivityOhmM} ohm-m.`
      }
      return {
        verdict,
        station: stationRows[0].station,
        summary,
        claims: stationRows.map((r) => ({
          value: `${r.reportedAquiferResistivityOhmM} ohm-m`,
          source: citation(r),
        })),
        trusted: trusted ? {value: `${trusted.reportedAquiferResistivityOhmM} ohm-m`, source: citation(trusted)} : null,
      }
    }
  }

  const row = stationRows[0]
  if (!row) {
    return {verdict: 'uncertain', station: null, summary: 'No matching station found in the offline snapshot.'}
  }

  if (Array.isArray(row.layers) && row.layers.length >= 3 && row.curveTypePublished) {
    const {derived, published, matches} = checkLabel(row)
    if (!matches) {
      return {
        verdict: 'label mismatch',
        station: row.station,
        summary: `Published curve type "${published}" does not match the type derived from this reading's own layer values ("${derived}").`,
        published,
        derived,
        source: citation(row),
        numbers: {
          resistivity: row.reportedAquiferResistivityOhmM,
          depth: row.reportedAquiferDepthM,
          thickness: row.reportedAquiferThicknessM,
        },
      }
    }
  }

  if (Array.isArray(row.layers) && row.layers.length >= 2) {
    const depthCheck = checkDepthArithmetic(row)
    if (!depthCheck.matches) {
      return {
        verdict: 'anomalous',
        station: row.station,
        summary: `Layer ${depthCheck.layerIndex}'s printed cumulative depth (${depthCheck.printed} m) does not reconcile with the paper's own numbers: ${depthCheck.priorCumulativeDepthM} m (prior layer) + ${depthCheck.thicknessM} m (this layer's thickness) = ${depthCheck.calculated} m.`,
        source: citation(row),
        numbers: {
          resistivity: row.reportedAquiferResistivityOhmM,
          depth: row.reportedAquiferDepthM,
          thickness: row.reportedAquiferThicknessM,
        },
      }
    }
  }

  return {
    verdict: 'normal',
    station: row.station,
    summary: `Single, uncontested reading for this station. No known table-swap or curve-type mismatch.`,
    source: citation(row),
    numbers: {
      resistivity: row.reportedAquiferResistivityOhmM,
      depth: row.reportedAquiferDepthM,
      thickness: row.reportedAquiferThicknessM,
    },
  }
}

async function offlineAsk(question) {
  const dataset = loadSnapshot()
  const catalog = buildCatalog(dataset)
  const siteName = resolveSiteFromCatalog(question, catalog)
  if (!siteName) {
    return {verdict: 'uncertain', station: null, summary: 'Could not resolve a site from the question wording.', groqQuery: null}
  }
  const query = buildSiteQuery(siteName)
  const rows = await runLocalGroq(query, dataset)
  const answer = ruleBasedAnswer(question, rows)
  answer.groqQuery = query
  answer.documentIds = rows.map((r) => r._id)
  return answer
}

function formatForCli(answer) {
  const badge = {normal: 'NORMAL', anomalous: 'ANOMALOUS', 'label mismatch': 'LABEL MISMATCH', uncertain: 'UNCERTAIN'}[
    answer.verdict
  ]
  let out = `[${badge}] ${answer.station || ''}\n${answer.summary}\n`
  if (answer.claims) {
    out += `\nClaims:\n${answer.claims.map((c) => `  - ${c.value} (${c.source})`).join('\n')}\n`
    if (answer.trusted) out += `\nTrusted: ${answer.trusted.value} (${answer.trusted.source})\n`
  }
  if (answer.numbers) {
    out += `\nNumbers:\n  - resistivity: ${answer.numbers.resistivity} ohm-m\n  - depth: ${answer.numbers.depth} m\n  - thickness: ${answer.numbers.thickness} m\n`
  }
  if (answer.source) out += `\nSource: ${answer.source}\n`
  if (answer.published) out += `\nPublished curve type: ${answer.published}   Derived: ${answer.derived}\n`
  out += `\nGROQ query run locally:\n  ${answer.groqQuery}\n`
  if (answer.documentIds) out += `\nDocument IDs used:\n${answer.documentIds.map((id) => `  - ${id}`).join('\n')}\n`
  out += `\nNo LLM call and no Knowledge Base call were made. Explanations and cross-source reasoning need a connection -- this is a rule-based read of the local dataset snapshot only.\n`
  return out
}

module.exports = {offlineAsk, formatForCli, loadSnapshot, buildCatalog, runLocalGroq}
