const {env} = require('./mcp.js')

const BASE_URL = env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const MODEL = env.QWEN_MODEL || 'qwen-plus'

async function callOnce(systemPrompt, userPrompt) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {role: 'system', content: systemPrompt},
        {role: 'user', content: userPrompt},
      ],
      temperature: 0.2,
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(`Qwen call failed (${res.status}): ${text}`)
    err.status = res.status
    throw err
  }
  const data = JSON.parse(text)
  const out = data.choices?.[0]?.message?.content
  if (!out) throw new Error(`Qwen returned no content: ${text}`)
  return out
}

// One bounded retry on transient overload (429/503), not an open-ended retry loop.
async function qwen(systemPrompt, userPrompt) {
  try {
    return await callOnce(systemPrompt, userPrompt)
  } catch (e) {
    if (e.status !== 429 && e.status !== 503) throw e
    await new Promise((r) => setTimeout(r, 3000))
    return callOnce(systemPrompt, userPrompt)
  }
}

module.exports = {qwen}
