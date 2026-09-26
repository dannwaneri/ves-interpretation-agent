// Phase 4 step 5: scores every saved run against eval/questions.json's
// expected verdict/conflict, per condition, and reports the spread across
// the 3 reps instead of just the best run. Every failure is listed, not
// averaged away.
const fs = require('fs')
const path = require('path')

const RESULTS_DIR = path.join(__dirname, 'results')
const {questions} = require('./questions.json')

function loadRuns() {
  const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('manifest'))
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8')))
}

function scoreQuestion(q, runs) {
  const byCondition = {structured: [], baseline: []}
  for (const r of runs.filter((r) => r.questionId === q.id)) {
    byCondition[r.condition].push(r)
  }

  const summarize = (condRuns) => {
    const ok = condRuns.filter((r) => r.ok)
    const failed = condRuns.filter((r) => !r.ok)
    const verdicts = ok.map((r) => r.answer.verdict)
    const verdictMatches = verdicts.filter((v) => v === q.expectedVerdict).length
    const conflictFlags = ok.map((r) => Boolean(r.answer.conflict))
    const conflictMatches = conflictFlags.filter((c) => c === q.expectedConflict).length
    return {
      runs: condRuns.length,
      ok: ok.length,
      failed: failed.map((r) => r.error),
      verdicts,
      verdictMatches,
      verdictSpreadOk: new Set(verdicts).size === 1,
      conflictFlags,
      conflictMatches,
    }
  }

  return {
    id: q.id,
    question: q.question,
    expectedVerdict: q.expectedVerdict,
    expectedConflict: q.expectedConflict,
    structured: summarize(byCondition.structured),
    baseline: summarize(byCondition.baseline),
  }
}

function main() {
  const runs = loadRuns()
  const scores = questions.map((q) => scoreQuestion(q, runs))

  let md = `# Eval scorecard\n\nGenerated ${new Date().toISOString().slice(0, 10)}. ${runs.length} total runs, 3 reps per question per condition.\n\n`
  md += `| Question | Cond | Verdict runs (expected: **VERDICT**) | Verdict score | Consistent across reps? | Conflict score |\n`
  md += `|---|---|---|---|---|---|\n`

  let structuredVerdictTotal = 0
  let structuredVerdictCorrect = 0
  let baselineVerdictTotal = 0
  let baselineVerdictCorrect = 0
  let structuredConflictTotal = 0
  let structuredConflictCorrect = 0
  let baselineConflictTotal = 0
  let baselineConflictCorrect = 0
  const failures = []

  for (const s of scores) {
    for (const cond of ['structured', 'baseline']) {
      const c = s[cond]
      md += `| ${s.id} | ${cond} | ${c.verdicts.join(', ') || '(all failed)'} (expected: **${s.expectedVerdict}**) | ${c.verdictMatches}/${c.ok} | ${c.verdictSpreadOk ? 'yes' : '**NO**'} | ${c.conflictMatches}/${c.ok} (expected conflict=${s.expectedConflict}) |\n`
      if (cond === 'structured') {
        structuredVerdictTotal += c.ok
        structuredVerdictCorrect += c.verdictMatches
        structuredConflictTotal += c.ok
        structuredConflictCorrect += c.conflictMatches
      } else {
        baselineVerdictTotal += c.ok
        baselineVerdictCorrect += c.verdictMatches
        baselineConflictTotal += c.ok
        baselineConflictCorrect += c.conflictMatches
      }
      if (c.failed.length > 0) {
        failures.push(`${s.id} / ${cond}: ${c.failed.length} run(s) errored -- ${c.failed.join('; ')}`)
      }
      if (!c.verdictSpreadOk) {
        failures.push(`${s.id} / ${cond}: inconsistent verdict across 3 reps -- ${c.verdicts.join(', ')} (expected ${s.expectedVerdict})`)
      }
      if (c.ok > 0 && c.verdictMatches < c.ok) {
        failures.push(`${s.id} / ${cond}: ${c.ok - c.verdictMatches}/${c.ok} run(s) gave the wrong verdict (expected ${s.expectedVerdict}, got ${c.verdicts.join(', ')})`)
      }
      if (c.ok > 0 && c.conflictMatches < c.ok) {
        failures.push(`${s.id} / ${cond}: ${c.ok - c.conflictMatches}/${c.ok} run(s) got conflict detection wrong (expected conflict=${s.expectedConflict}, got [${c.conflictFlags.join(', ')}])`)
      }
    }
  }

  md += `\n## Totals\n\n`
  md += `- Structured verdict accuracy: ${structuredVerdictCorrect}/${structuredVerdictTotal} (${((structuredVerdictCorrect / structuredVerdictTotal) * 100).toFixed(0)}%)\n`
  md += `- Baseline verdict accuracy: ${baselineVerdictCorrect}/${baselineVerdictTotal} (${((baselineVerdictCorrect / baselineVerdictTotal) * 100).toFixed(0)}%)\n`
  md += `- Structured conflict-detection accuracy: ${structuredConflictCorrect}/${structuredConflictTotal} (${((structuredConflictCorrect / structuredConflictTotal) * 100).toFixed(0)}%)\n`
  md += `- Baseline conflict-detection accuracy: ${baselineConflictCorrect}/${baselineConflictTotal} (${((baselineConflictCorrect / baselineConflictTotal) * 100).toFixed(0)}%)\n`

  md += `\n## Every failure (not tuned away)\n\n`
  if (failures.length === 0) {
    md += 'None.\n'
  } else {
    for (const f of failures) md += `- ${f}\n`
  }

  const outPath = path.join(RESULTS_DIR, `scorecard--${new Date().toISOString().slice(0, 10)}.md`)
  fs.writeFileSync(outPath, md)
  console.log(md)
  console.log(`\nWritten to ${outPath}`)
}

main()
