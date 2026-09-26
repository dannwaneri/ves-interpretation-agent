// Runs every eval/questions.json question through both conditions, 3 times
// each (per the task's Phase 4 addition: report the spread, not just the
// best run). Saves every raw output to eval/results/ as it completes, so a
// crash partway through doesn't lose finished runs.
const fs = require('fs')
const path = require('path')
const {ask} = require('../agent/index.js')
const {keywordAnswer} = require('./baseline.js')

const REPS = 3
const MODEL = process.env.QWEN_MODEL || 'qwen-plus'
const DATE = new Date().toISOString().slice(0, 10)
const RESULTS_DIR = path.join(__dirname, 'results')

const {questions} = require('./questions.json')

function resultPath(questionId, condition, run) {
  return path.join(RESULTS_DIR, `${questionId}--${condition}--run${run}--${DATE}.json`)
}

async function runOnce(condition, question) {
  const start = Date.now()
  try {
    const answer = condition === 'structured' ? await ask(question) : await keywordAnswer(question)
    return {ok: true, answer, durationMs: Date.now() - start}
  } catch (e) {
    return {ok: false, error: e.message, durationMs: Date.now() - start}
  }
}

async function main() {
  fs.mkdirSync(RESULTS_DIR, {recursive: true})
  const manifest = []

  for (const q of questions) {
    for (const condition of ['structured', 'baseline']) {
      for (let run = 1; run <= REPS; run++) {
        process.stdout.write(`[${q.id}] ${condition} run ${run}/${REPS} ... `)
        const result = await runOnce(condition, q.question)
        const record = {
          questionId: q.id,
          question: q.question,
          condition,
          run,
          model: MODEL,
          date: DATE,
          ...result,
        }
        const file = resultPath(q.id, condition, run)
        fs.writeFileSync(file, JSON.stringify(record, null, 2))
        manifest.push({file: path.basename(file), questionId: q.id, condition, run, ok: result.ok})
        console.log(result.ok ? `ok (${result.durationMs}ms, verdict=${result.answer.verdict})` : `FAILED: ${result.error}`)
      }
    }
  }

  fs.writeFileSync(path.join(RESULTS_DIR, `manifest--${DATE}.json`), JSON.stringify(manifest, null, 2))
  console.log(`\nDone. ${manifest.filter((m) => m.ok).length}/${manifest.length} runs succeeded.`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
