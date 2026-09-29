// Checks a reading's own layer table for internal arithmetic consistency:
// each layer's cumulative depth should equal the previous layer's
// cumulative depth plus this layer's thickness. A mismatch means the
// printed depth and the printed thickness for that layer don't reconcile
// with each other -- it does NOT identify which of the two printed numbers
// is the error.
//
// For Egwi (Etche), the paper's own Figure 2 narrative text repeats both
// the printed thickness (~37.95 m) and the printed depth (37.25 m). That
// does NOT prove either number is correct -- the prose plausibly just
// copies Table 1's own values, so it's one source stated twice, not two
// independent measurements. What it does establish is that the
// inconsistency is in the authors' own reported values, not a single
// isolated print/OCR typo in one table cell. Layers 1-3 for the same
// station reconcile to within rounding using either source (Table 1 or the
// prose), confirming this check is exact, not noisy -- only layer 4 fails.
// Resolving which number (if either) is actually wrong would need the raw
// field data (AB/2 spacing vs. apparent resistivity) to re-run the
// inversion; that's out of scope here. Report both readings; do not guess.
//
// Tolerance calibrated against every known case across both sites, not just
// the two originally checked: published tables round thickness/depth to 1-3
// significant digits, so ordinary rounding alone can produce up to ~0.3 m of
// drift even on a station with no documented issue (Bori's Court-road, all
// 3 layer transitions: 0.06, 0.10, 0.30 m). The 7 confirmed real errors
// across both papers range from ~0.8 m (Etche's Akpoku, layer 2) to ~11.0 m
// (Etche's Ulakwo, layer 3) -- a first pass at this tolerance (1.0 m) missed
// Akpoku's 0.795 m error entirely, a false negative caught only by directly
// verifying every documented case against the raw PDF text rather than
// assuming the two originally-checked examples (Egwi, Court-road)
// represented the full range. 0.5 m sits in the gap between the largest
// known clean noise (0.30 m) and the smallest known real error (0.795 m).
const TOLERANCE_M = 0.5

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

// Fixed-template statement, generated in code, not the model. The prompt
// alone was tried first and, even after two rounds of tightening, still
// produced runs that leaned toward calling one specific number the error --
// an LLM will not reliably repeat exact wording it wasn't forced to. This
// matches the rest of the design (code decides facts, the model explains
// them) and removes the wording variation entirely rather than reducing it.
function depthInconsistencyStatement(check) {
  return (
    `${check.station}, layer ${check.layerIndex}: the printed depth (${check.printedCumulativeDepthM} m) ` +
    `and the printed thickness (${check.printedThicknessM} m) do not reconcile with the prior layer's depth ` +
    `(${check.priorCumulativeDepthM} m). If the thickness is correct, the depth should be ` +
    `${check.impliedDepthIfThicknessCorrect} m. If the depth is correct, the thickness should be ` +
    `${check.impliedThicknessIfDepthCorrect} m. The paper does not give enough information to determine ` +
    `which printed number is wrong.`
  )
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

module.exports = {checkDepthArithmetic, depthArithmeticChecks, depthInconsistencyStatement}
