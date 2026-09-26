// Checks a reading's own layer table for internal arithmetic consistency:
// each layer's cumulative depth should equal the previous layer's
// cumulative depth plus this layer's thickness. A mismatch means the
// printed depth and the printed thickness for that layer don't reconcile
// with each other -- it does NOT identify which of the two printed numbers
// is the error. For Egwi (Etche), the paper's own Figure 2 narrative text
// repeats both the printed thickness (~37.95 m) and the printed depth
// (37.25 m) independently of Table 1, so this is a real, repeated
// inconsistency in the published paper, not a single isolated typo one
// value can be confidently blamed for. Report both readings; let a human
// with the raw field data decide which one is right, if either.
//
// Tolerance is deliberately generous, not tight: published tables round
// thickness/depth to 1-3 significant digits, so ordinary rounding alone can
// produce ~0.3 m of drift even on a station with no known issue (confirmed
// against Bori's Court-road, which has no documented problem). The real
// documented errors are off by ~7-10 m, a wide enough gap that 1.0 m
// cleanly separates rounding noise from a genuine inconsistency.
const TOLERANCE_M = 1.0

function sortLayersByIndex(layers) {
  return [...layers].sort((a, b) => (a.layerIndex ?? 0) - (b.layerIndex ?? 0))
}

function checkDepthArithmetic(reading) {
  const layers = sortLayersByIndex(reading.layers || [])
  for (let i = 1; i < layers.length; i++) {
    const prev = layers[i - 1]
    const cur = layers[i]
    if (
      typeof prev.cumulativeDepthM !== 'number' ||
      typeof cur.cumulativeDepthM !== 'number' ||
      typeof cur.thicknessM !== 'number'
    ) {
      continue
    }
    const impliedDepthIfThicknessCorrect = prev.cumulativeDepthM + cur.thicknessM
    const impliedThicknessIfDepthCorrect = cur.cumulativeDepthM - prev.cumulativeDepthM
    const diff = Math.abs(impliedDepthIfThicknessCorrect - cur.cumulativeDepthM)
    if (diff > TOLERANCE_M) {
      return {
        station: reading.station,
        matches: false,
        layerIndex: cur.layerIndex,
        priorCumulativeDepthM: prev.cumulativeDepthM,
        printedThicknessM: cur.thicknessM,
        printedCumulativeDepthM: cur.cumulativeDepthM,
        impliedDepthIfThicknessCorrect: Number(impliedDepthIfThicknessCorrect.toFixed(4)),
        impliedThicknessIfDepthCorrect: Number(impliedThicknessIfDepthCorrect.toFixed(4)),
        note: 'This layer\'s printed depth and printed thickness do not reconcile with each other. This does not identify which printed number is wrong, only that they disagree.',
      }
    }
  }
  return {station: reading.station, matches: true}
}

// Same pattern as curveType.js's curveTypeChecks(): computed in code and
// handed to the model as a fact to narrate carefully, not a judgment call
// to make itself (which produced a "the depth is wrong" claim when left
// unguided -- see the README's Limitations section).
function depthArithmeticChecks(rows) {
  return rows
    .filter((r) => Array.isArray(r.layers) && r.layers.length >= 2)
    .map((r) => {
      try {
        return checkDepthArithmetic(r)
      } catch (e) {
        return {station: r.station, error: e.message}
      }
    })
    .filter((c) => c.matches === false)
}

module.exports = {checkDepthArithmetic, depthArithmeticChecks}
