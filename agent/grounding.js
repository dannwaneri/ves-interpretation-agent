// Shared between the online agent and --public mode: enforces in code, not
// just in the prompt, that a synthesized answer's numbers and conflict
// claims actually trace back to the retrieved GROQ data.

function flattenKnownNumbers(rows) {
  const known = new Set()
  for (const r of rows) {
    for (const key of ['reportedAquiferResistivityOhmM', 'reportedAquiferDepthM', 'reportedAquiferThicknessM', 'rmsPercent']) {
      if (typeof r[key] === 'number') known.add(r[key])
    }
    for (const layer of r.layers || []) {
      for (const key of ['resistivityOhmM', 'thicknessM', 'cumulativeDepthM', 'layerIndex']) {
        if (typeof layer[key] === 'number') known.add(layer[key])
      }
    }
  }
  return known
}

// Only counts a number as a "claim" if it's attached to a measurement unit
// (ohm-m, %, or a bare meter figure). Citation numbers like "Table 9" or a
// publication year ("2022") are not data claims and must not trip the
// grounding check just because they're digits.
function numbersIn(text) {
  const re = /(-?\d+(?:\.\d+)?)\s*(?:ohm-?m|ohm·m|Ω·m|%|m(?![a-zA-Z]))/gi
  return [...String(text).matchAll(re)].map((m) => parseFloat(m[1]))
}

// Rule enforcement in code: the "numbers" list is informational, so an
// ungrounded entry there only gets a warning. A fabricated "conflict" is
// worse -- it tells the reader two real sources disagree when they don't
// (see the Kenpoly Convocation Arena case found during Phase 4 eval, where
// the model borrowed a different station's documented swap value). So a
// conflict whose claims cite a number absent from the GROQ data gets
// dropped in code, not just flagged.
function enforceGrounding(answer, rows, curveChecks) {
  const known = flattenKnownNumbers(rows)

  for (const n of answer.numbers || []) {
    for (const val of numbersIn(n.value)) {
      if (!known.has(val)) {
        console.error(`[agent] warning: numbers[] value "${n.value}" was not found in the GROQ data -- may not be grounded`)
      }
    }
  }

  if (answer.conflict) {
    const claimNumbers = [
      ...numbersIn(answer.conflict.claimA || ''),
      ...numbersIn(answer.conflict.claimB || ''),
      ...numbersIn(answer.conflict.trusted || ''),
    ]
    const ungrounded = claimNumbers.filter((v) => !known.has(v))
    if (ungrounded.length > 0) {
      console.error(
        `[agent] dropping fabricated conflict: claim cites ${ungrounded.join(', ')}, not present in the GROQ data for this station`
      )
      answer.conflict = null
      const hasGroundedMismatch = (curveChecks || []).some((c) => c.matches === false)
      if (answer.verdict === 'anomalous' && !hasGroundedMismatch) answer.verdict = 'uncertain'
    }
  }
}

module.exports = {flattenKnownNumbers, numbersIn, enforceGrounding}
