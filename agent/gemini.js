const {env} = require('./mcp.js')

async function callOnce(systemPrompt, userPrompt) {
  const model = 'gemini-3.6-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      systemInstruction: {parts: [{text: systemPrompt}]},
      contents: [{role: 'user', parts: [{text: userPrompt}]}],
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(`Gemini call failed (${res.status}): ${text}`)
    err.status = res.status
    throw err
  }
  const data = JSON.parse(text)
  const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')
  if (!out) throw new Error(`Gemini returned no text: ${text}`)
  return out
}

// One bounded retry on transient overload (503), not an open-ended retry loop.
async function gemini(systemPrompt, userPrompt) {
  try {
    return await callOnce(systemPrompt, userPrompt)
  } catch (e) {
    if (e.status !== 503) throw e
    await new Promise((r) => setTimeout(r, 3000))
    return callOnce(systemPrompt, userPrompt)
  }
}

module.exports = {gemini}
