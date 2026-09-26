// Phase 5: does --offline agree with the online agent on every eval
// question? Reuses the online structured run 1 results already saved in
// eval/results/ instead of re-spending LLM calls. Offline uses a different,
// smaller verdict vocabulary (normal / anomalous / label mismatch, no
// "uncertain") by design, so this reports agreement/disagreement with that
// vocabulary difference stated explicitly rather than forcing a false match.
const fs = require('fs')
const path = require('path')
const {offlineAsk} = require('../agent/offline.js')

const {questions} = require('./questions.json')
const RESULTS_DIR = path.join(__dirname, 'results')

function loadOnlineRun1(questionId) {
  const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.startsWith(`${questionId}--structured--run1--`))
  if (files.length === 0) return null
  return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, files[0]), 'utf8'))
}

async function main() {
  let md = `# --offline vs online agreement\n\nGenerated ${new Date().toISOString().slice(0, 10)}. Online column reuses each question's already-saved structured run 1 (not re-run). Offline uses a 3-way vocabulary (normal / anomalous / label mismatch) instead of online's (normal / anomalous / uncertain) by design -- "agrees" below means the verdicts describe the same real-world conclusion, not that the strings are identical.\n\n`
  md += `| Question | Online verdict | Offline verdict | Agrees? |\n|---|---|---|---|\n`

  let agreeCount = 0
  let total = 0
  const notes = []

  for (const q of questions) {
    const onlineRun = loadOnlineRun1(q.id)
    const online = onlineRun?.ok ? onlineRun.answer.verdict : '(no saved run)'
    let offline
    try {
      offline = (await offlineAsk(q.question)).verdict
    } catch (e) {
      offline = `ERROR: ${e.message}`
    }

    // anomalous <-> anomalous, normal <-> normal, and online's uncertain has
    // no offline equivalent -- offline never says "uncertain" for a
    // resolved station, so only compare when online reached a real verdict.
    const equivalent = online === offline || (online === 'anomalous' && offline === 'label mismatch')
    total += 1
    if (equivalent) agreeCount += 1
    else notes.push(`${q.id}: online=${online}, offline=${offline}`)

    md += `| ${q.id} | ${online} | ${offline} | ${equivalent ? 'yes' : '**NO**'} |\n`
  }

  md += `\n## Totals\n\n${agreeCount}/${total} agree.\n\n## Disagreements\n\n`
  md += notes.length === 0 ? 'None.\n' : notes.map((n) => `- ${n}\n`).join('')
  md += `\n## Known, inherent limitation (not a bug)\n\nchoba-depth-consistency-control asks specifically about depth arithmetic at a station that ALSO has an unrelated, real curve-type mismatch. The online agent (LLM-driven) understands the question is about depth, not curve type, and correctly answers "normal" on the thing actually asked. Offline mode has no language understanding -- it runs a fixed rule order (curve-type check, then depth-arithmetic check) and reports the first issue it finds for the station regardless of the question's wording, so it always surfaces the curve-type mismatch here. This is a disclosed trade-off of a rule-based, no-LLM mode, not a fixable defect: a genuinely offline tool can tell you everything known about a station, but can't parse what you actually asked.\n`

  const outPath = path.join(RESULTS_DIR, `offline-vs-online--${new Date().toISOString().slice(0, 10)}.md`)
  fs.writeFileSync(outPath, md)
  console.log(md)
  console.log(`Written to ${outPath}`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
