const {env} = require('./mcp.js')

async function gemini(systemPrompt, userPrompt) {
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
  if (!res.ok) throw new Error(`Gemini call failed (${res.status}): ${text}`)
  const data = JSON.parse(text)
  const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')
  if (!out) throw new Error(`Gemini returned no text: ${text}`)
  return out
}

module.exports = {gemini}
