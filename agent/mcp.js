const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  const text = fs.readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return env
}

const env = loadEnv()

let rpcId = 1
async function mcpCall(toolName, args) {
  const res = await fetch(env.SANITY_MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SANITY_CONTEXT_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {name: toolName, arguments: args || {}},
      id: rpcId++,
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`MCP call failed (${res.status}): ${text}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

module.exports = {env, mcpCall}
