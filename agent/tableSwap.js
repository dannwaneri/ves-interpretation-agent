// Same pattern as curveType.js: disambiguating which of two same-station
// documents is trustworthy is a mechanical rule, not a judgment call, so
// it's computed here in code rather than left for the model to reason out
// from sourceLocation text. Needed for --public mode specifically: without
// the Knowledge Base's authoritative narrative, qwen was observed getting
// this backwards repeatedly (trusting the summary-table value, or even
// reassigning a value to a different station's name) when asked to reason
// about it in prose instead of being handed the answer directly.
function tableSwapChecks(rows) {
  const byStation = new Map()
  for (const r of rows) {
    if (!byStation.has(r.station)) byStation.set(r.station, [])
    byStation.get(r.station).push(r)
  }

  const checks = []
  for (const [station, docs] of byStation) {
    const values = new Set(docs.map((d) => d.reportedAquiferResistivityOhmM))
    if (docs.length < 2 || values.size < 2) continue

    const preferred = docs.filter((d) => !/summary table/i.test(d.sourceLocation || ''))
    checks.push({
      station,
      claims: docs.map((d) => ({
        value: d.reportedAquiferResistivityOhmM,
        sourceLocation: d.sourceLocation,
        documentId: d._id,
      })),
      trustedValue: preferred.length === 1 ? preferred[0].reportedAquiferResistivityOhmM : null,
      trustedDocumentId: preferred.length === 1 ? preferred[0]._id : null,
      rule: 'the claim whose sourceLocation is NOT a summary-table reference is trusted -- every documented swap in this dataset is a summary-table transcription error',
    })
  }
  return checks
}

module.exports = {tableSwapChecks}
