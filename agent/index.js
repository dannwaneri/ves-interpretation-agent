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

Response shape, in this order:
1. VERDICT -- one short plain-language sentence: normal / anomalous / uncertain, and why, in words a non-geologist can follow.
2. SOURCES -- which paper(s), table(s), or figure(s) you drew on.
3. NUMBERS -- the raw resistivity/depth/thickness values as receipts, for anyone who wants to check.

If the retrieved entries show two sources disagreeing on the same fact, state both values explicitly and say which one is trusted and why -- do not silently pick one and hide the conflict. If the entries don't contain enough to answer, say so plainly instead of guessing.`
  const userPrompt = `Retrieved knowledge base entries:\n${entriesText}\n\nQuestion: ${query}`
  return gemini(systemPrompt, userPrompt)
}

async function ask(query) {
  const outline = await getOutline()
  const paths = await selectPaths(query, outline)
  console.error(`[agent] selected entries: ${paths.join(', ')}`)
  const entriesText = await readEntries(paths)
  const answer = await synthesize(query, entriesText)
  return answer
}

async function main() {
  const query = process.argv.slice(2).join(' ')
  if (!query) {
    console.error('Usage: node agent/index.js "your question"')
    process.exit(1)
  }
  const answer = await ask(query)
  console.log('\n' + answer)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('FATAL:', e.message)
    process.exit(1)
  })
}

module.exports = {ask}
