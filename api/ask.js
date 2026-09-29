// Calls agent/index.js --offline as a child process, exactly the command
// the submission post tells judges to run themselves. This function never
// imports agent code into a bundle and never changes it: it shells out to
// the real, frozen CLI, so the web page and the CLI can never give
// different answers.
const {execFile} = require('child_process')
const path = require('path')

const AGENT_ENTRY = path.join(process.cwd(), 'agent', 'index.js')
const MAX_QUESTION_LENGTH = 300
const TIMEOUT_MS = 10000

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Use POST.'})
    return
  }

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : ''
  if (!question) {
    res.status(400).json({error: 'Send a question.'})
    return
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    res.status(400).json({error: `Question is too long (max ${MAX_QUESTION_LENGTH} characters).`})
    return
  }

  execFile(
    'node',
    [AGENT_ENTRY, '--offline', question],
    {timeout: TIMEOUT_MS, cwd: process.cwd()},
    (err, stdout, stderr) => {
      if (err && err.killed) {
        res.status(504).json({error: 'The offline check took too long and was stopped.'})
        return
      }
      if (err) {
        res.status(200).json({error: 'The offline check could not answer that. Try one of the example questions.', detail: String(stderr || err.message).slice(0, 500)})
        return
      }
      res.status(200).json({output: stdout})
    }
  )
}
