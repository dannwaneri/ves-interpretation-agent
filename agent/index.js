const {env, mcpCall} = require('./mcp.js')
const {gemini} = require('./gemini.js')

async function getOutline() {
  const res = await mcpCall('initial_context', {})
  const text = res.result?.content?.[0]?.text
  if (!text) throw new Error(`initial_context returned no text: ${JSON.stringify(res)}`)
  return text
}

async function selectPaths(query, outline) {
  const systemPrompt = `You select which entries to read from a VES (Vertical Electrical Sounding) knowledge base outline, given a question. Reply with ONLY a JSON array of entry path strings (from the outline, exactly as written), most relevant first. Pick every entry that could plausibly bear on the question, including source-error / mislabeling entries when the question touches a specific station or site, since those often contain the real answer. Return at most 6 paths. No prose, no markdown, just the JSON array.`
  const userPrompt = `Outline:\n${outline}\n\nQuestion: ${query}\n\nJSON array of entry paths:`
  const raw = await gemini(systemPrompt, userPrompt)
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`Could not parse path selection from: ${raw}`)
  return JSON.parse(match[0])
}

async function readEntries(paths) {
  const res = await mcpCall('knowledge_base_read', {knowledgeBase: env.SANITY_KB_ID, paths})
  const text = res.result?.content?.[0]?.text
  if (!text) throw new Error(`knowledge_base_read returned no text: ${JSON.stringify(res)}`)
  return text
}

async function synthesize(query, entriesText) {
  const systemPrompt = `You are a VES interpretation assistant. Answer ONLY from the retrieved knowledge base entries given below -- never invent a number, station, or source that is not in them.

Write for a general audience with NO geology background -- a judge reading this has never heard of resistivity or VES surveys. Every sentence must be understandable on first read. If you need a technical term (like "resistivity" or the unit "ohm-m"), briefly explain it in plain words the first time you use it, in parentheses.

Reply with ONLY a single JSON object (no markdown fences, no prose outside it), in exactly this shape:
{
  "verdict": "normal" | "anomalous" | "uncertain",
  "headline": "one short plain-English sentence stating the verdict and the single biggest reason why -- something a 10-year-old could follow",
  "explanation": "1-2 more plain sentences of context, still jargon-free",
  "conflict": null OR {
    "plainSummary": "one plain sentence describing what's inconsistent in the source material itself",
    "claimA": "short plain description of the first claim, with its value",
    "claimB": "short plain description of the second, disagreeing claim, with its value",
    "trusted": "which one is trusted",
    "why": "one plain sentence on why that one is trusted"
  },
  "sources": ["short citation strings, e.g. 'Menegbo et al. (2024), Table 1, p.7'"],
  "numbers": [{"label": "short label", "value": "value with unit"}]
}

Set "conflict" to null if the retrieved entries show no disagreement. If the entries don't contain enough to answer, set verdict to "uncertain" and say so plainly in headline/explanation instead of guessing.`
  const userPrompt = `Retrieved knowledge base entries:\n${entriesText}\n\nQuestion: ${query}`
  const raw = await gemini(systemPrompt, userPrompt)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Could not parse structured answer from: ${raw}`)
  return JSON.parse(match[0])
}

async function ask(query) {
  const outline = await getOutline()
  const paths = await selectPaths(query, outline)
  console.error(`[agent] selected entries: ${paths.join(', ')}`)
  const entriesText = await readEntries(paths)
  return synthesize(query, entriesText)
}

function formatForCli(answer) {
  const badge = {normal: 'NORMAL', anomalous: 'ANOMALOUS', uncertain: 'UNCERTAIN'}[answer.verdict] || answer.verdict.toUpperCase()
  let out = `[${badge}] ${answer.headline}\n\n${answer.explanation}\n`
  if (answer.conflict) {
    out += `\nSOURCE DISAGREEMENT FOUND:\n  ${answer.conflict.plainSummary}\n  Claim A: ${answer.conflict.claimA}\n  Claim B: ${answer.conflict.claimB}\n  Trusted: ${answer.conflict.trusted} -- ${answer.conflict.why}\n`
  }
  out += `\nSources:\n${answer.sources.map((s) => `  - ${s}`).join('\n')}\n`
  out += `\nNumbers:\n${answer.numbers.map((n) => `  - ${n.label}: ${n.value}`).join('\n')}\n`
  return out
}

async function main() {
  const query = process.argv.slice(2).join(' ')
  if (!query) {
    console.error('Usage: node agent/index.js "your question"')
    process.exit(1)
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
